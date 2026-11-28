import { Booking, BookingStatus, Business, BusinessLocation, BusinessSettings, MyBooking, Professional, Promotion, Service } from '../types';
import { INITIAL_SERVICES, DEFAULT_SETTINGS, ADMIN_CREDENTIALS, DEMO_BUSINESS } from '../constants';
import { lastTenDigits } from './format';
import { isSupabaseEnabled, supabaseRequest, signIn, signOut, getAccessToken, checkIsAdmin } from './supabase';

// La app tiene dos modos:
//  - Con Supabase (en línea): todos los datos se comparten entre todos los celulares
//    y cada negocio (tabla "businesses") tiene los suyos.
//  - Sin Supabase (modo demo): solo existe el negocio de ejemplo y sus datos se guardan
//    en el navegador de cada persona.
//
// Casi todas las funciones reciben el id del negocio (businessId). En modo demo ese id
// es igual al nombre de la dirección (slug) y sirve para separar lo guardado en el navegador.

// ---------------------------------------------------------------
// Modo demo (LocalStorage)
// ---------------------------------------------------------------

// Claves de almacenamiento en el navegador (una por negocio)
const storageKey = (kind: 'services' | 'bookings' | 'settings' | 'locations' | 'professionals', businessId: string): string =>
  `styleflow_${kind}_${businessId}`;

// Función auxiliar para leer de LocalStorage
const getFromStorage = <T>(key: string, defaultValue: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored);
  } catch (e) {
    return defaultValue;
  }
};

// Función auxiliar para escribir en LocalStorage
const saveToStorage = (key: string, data: any): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ---------------------------------------------------------------
// Ayudas para el modo en línea
// ---------------------------------------------------------------

const pad = (n: number): string => String(n).padStart(2, '0');

// Fecha local como "2026-11-26" (no se usa toISOString para no correr el día por la zona horaria)
const toDateString = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "2026-11-26" -> fecha local a las 12:00, así siempre cae en el mismo día
const dateStringToIso = (s: string): string => `${s}T12:00:00`;

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const mapService = (row: any): Service => ({
  id: row.id,
  title: row.title,
  price: row.price,
  durationMinutes: row.duration_minutes,
  description: row.description || '',
  locationId: row.location_id ?? null
});

const mapLocation = (row: any): BusinessLocation => ({
  id: row.id,
  name: row.name,
  address: row.address || '',
  mapsUrl: row.maps_url || '',
  capacity: row.capacity ?? null,
  workStartTime: row.work_start ?? null,
  workEndTime: row.work_end ?? null,
  breakStartTime: row.break_start ?? null,
  breakEndTime: row.break_end ?? null,
  offDays: Array.isArray(row.off_days) ? row.off_days : null,
  slotInterval: row.slot_interval ?? null,
  sortOrder: row.sort_order ?? 0,
  active: row.active !== false
});

const mapProfessional = (row: any): Professional => ({
  id: row.id,
  name: row.name,
  title: row.title || '',
  photoUrl: row.photo_url || '',
  locationId: row.location_id ?? null,
  workStartTime: row.work_start ?? null,
  workEndTime: row.work_end ?? null,
  breakStartTime: row.break_start ?? null,
  breakEndTime: row.break_end ?? null,
  offDays: Array.isArray(row.off_days) ? row.off_days : null,
  sortOrder: row.sort_order ?? 0,
  active: row.active !== false
});

const mapBooking = (row: any): Booking => ({
  id: row.id,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  selectedServices: Array.isArray(row.services) ? row.services : [],
  totalPrice: row.total_price,
  totalDuration: row.total_duration,
  date: dateStringToIso(row.booking_date),
  timeSlot: row.time_slot,
  createdAt: row.created_at,
  locationId: row.location_id ?? null,
  waiverAcceptedAt: row.waiver_accepted_at ?? null,
  folio: row.folio || undefined,
  professionalId: row.professional_id ?? null,
  status: row.status === 'confirmed' ? 'confirmed' : 'pending'
});

const mapSettings = (row: any): BusinessSettings => ({
  workStartTime: row.work_start,
  workEndTime: row.work_end,
  breakStartTime: row.break_start,
  breakEndTime: row.break_end,
  offDays: row.off_days || [],
  slotInterval: row.slot_interval,
  maxBookingsPerPhone: row.max_bookings_per_phone ?? DEFAULT_SETTINGS.maxBookingsPerPhone,
  capacity: row.capacity ?? DEFAULT_SETTINGS.capacity,
  waiverEnabled: row.waiver_enabled === true,
  waiverText: row.waiver_text || ''
});

const mapPromotion = (raw: any, index: number): Promotion => ({
  id: String(raw?.id ?? `promo-${index}`),
  title: String(raw?.title ?? ''),
  description: String(raw?.description ?? ''),
  days: raw?.days ? String(raw.days) : undefined,
  normalPrice: Number(raw?.normalPrice) || 0,
  promoPrice: Number(raw?.promoPrice) || 0
});

const mapBusiness = (row: any): Business => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  category: row.category || 'otro',
  tagline: row.tagline || '',
  whatsappNumber: row.whatsapp_number || '',
  displayPhone: row.display_phone || '',
  address: row.address || '',
  mapsUrl: row.maps_url || '',
  instagramUrl: row.instagram_url || '',
  facebookUrl: row.facebook_url || '',
  tiktokUrl: row.tiktok_url || '',
  perks: Array.isArray(row.perks) ? row.perks.map(String) : [],
  promotions: Array.isArray(row.promotions) ? row.promotions.map(mapPromotion) : [],
  theme: row.theme || '',
  brandColor: row.brand_color || '',
  logoUrl: row.logo_url || ''
});

// Cambios (PATCH / DELETE): si no se modificó ninguna fila, algo falló (por ejemplo, falta de permisos)
const mutate = async (path: string, method: 'PATCH' | 'DELETE', body?: unknown): Promise<void> => {
  const rows = await supabaseRequest<any[]>(path, {
    method,
    body,
    asAdmin: true,
    prefer: 'return=representation'
  });
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('not_saved');
  }
};

// ---------------------------------------------------------------
// Negocio
// ---------------------------------------------------------------

// Busca un negocio por el nombre de su dirección (slug). Regresa null si no existe o está desactivado.
export const getBusiness = async (slug: string): Promise<Business | null> => {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>(
      `/rest/v1/businesses?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`
    );
    return rows.length > 0 ? mapBusiness(rows[0]) : null;
  }
  return slug === DEMO_BUSINESS.slug ? DEMO_BUSINESS : null;
};

// ---------------------------------------------------------------
// Sesión del administrador
// ---------------------------------------------------------------

const adminFlagKey = (business: Business): string => `isAdmin_${business.slug}`;

// En modo en línea, "usuario" es el correo del administrador y debe ser administrador de ESTE negocio
export const loginAdmin = async (business: Business, username: string, password: string): Promise<boolean> => {
  if (isSupabaseEnabled()) {
    const ok = await signIn(username.trim(), password);
    if (!ok) return false;
    if (!(await checkIsAdmin(business.id))) {
      await signOut();
      return false;
    }
    return true;
  }

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    sessionStorage.setItem(adminFlagKey(business), 'true');
    return true;
  }
  return false;
};

export const isAdminLoggedIn = async (business: Business): Promise<boolean> => {
  if (isSupabaseEnabled()) {
    if ((await getAccessToken()) === null) return false;
    return checkIsAdmin(business.id);
  }
  return Boolean(sessionStorage.getItem(adminFlagKey(business)));
};

export const logoutAdmin = async (business: Business): Promise<void> => {
  sessionStorage.removeItem(adminFlagKey(business));
  if (isSupabaseEnabled()) {
    await signOut();
  }
};

// ---------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------

export const getServices = async (businessId: string): Promise<Service[]> => {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>(
      `/rest/v1/services?business_id=eq.${businessId}&select=*&order=sort_order.asc,created_at.asc`
    );
    return rows.map(mapService);
  }
  // Se copia la lista inicial para que agregar o borrar servicios no modifique la original
  return getFromStorage<Service[]>(storageKey('services', businessId), [...INITIAL_SERVICES]);
};

export const saveService = async (businessId: string, service: Service): Promise<void> => {
  if (isSupabaseEnabled()) {
    const body: Record<string, unknown> = {
      title: service.title,
      price: service.price,
      duration_minutes: service.durationMinutes,
      description: service.description || '',
      location_id: service.locationId || null
    };

    if (isUuid(service.id)) {
      await mutate(`/rest/v1/services?id=eq.${service.id}&business_id=eq.${businessId}`, 'PATCH', body);
    } else {
      // Servicio nuevo: la base de datos le asigna su id y lo manda al final de la lista
      const existing = await getServices(businessId);
      body.business_id = businessId;
      body.sort_order = existing.length + 1;
      await supabaseRequest('/rest/v1/services', {
        method: 'POST',
        body,
        asAdmin: true,
        prefer: 'return=minimal'
      });
    }
    return;
  }

  const services = await getServices(businessId);
  const index = services.findIndex(s => s.id === service.id);

  if (index >= 0) {
    services[index] = service;
  } else {
    services.push(service);
  }

  saveToStorage(storageKey('services', businessId), services);
};

export const deleteService = async (businessId: string, id: string): Promise<void> => {
  if (isSupabaseEnabled()) {
    if (isUuid(id)) {
      await mutate(`/rest/v1/services?id=eq.${id}&business_id=eq.${businessId}`, 'DELETE');
    }
    return;
  }

  const services = await getServices(businessId);
  const filtered = services.filter(s => s.id !== id);
  saveToStorage(storageKey('services', businessId), filtered);
};

// ---------------------------------------------------------------
// Citas
// ---------------------------------------------------------------

// Todas las citas con datos de clientes (solo para el administrador)
export const getBookings = async (businessId: string): Promise<Booking[]> => {
  let bookings: Booking[];

  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>(
      `/rest/v1/bookings?business_id=eq.${businessId}&select=*&order=booking_date.asc,time_slot.asc`,
      { asAdmin: true }
    );
    bookings = rows.map(mapBooking);
  } else {
    bookings = getFromStorage<Booking[]>(storageKey('bookings', businessId), []);
  }

  // Ordenar de la más reciente a la más antigua
  return bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// Horarios ocupados, SIN nombres ni celulares (para la pantalla de reservas de los clientes)
export const getTakenSlots = async (businessId: string): Promise<Booking[]> => {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>('/rest/v1/rpc/get_booked_slots', {
      method: 'POST',
      body: { p_business: businessId, p_from: toDateString(new Date()) }
    });
    return rows.map(row => ({
      id: '',
      customerName: '',
      customerPhone: '',
      selectedServices: [],
      totalPrice: 0,
      totalDuration: row.total_duration,
      date: dateStringToIso(row.booking_date),
      timeSlot: row.time_slot,
      createdAt: '',
      locationId: row.location_id ?? null,
      professionalId: row.professional_id ?? null
    }));
  }
  return getBookings(businessId);
};

// Folio de 4 letras para el modo demo (sin I, L, O ni Q, que se confunden)
const FOLIO_LETTERS = 'ABCDEFGHJKMNPRSTUVWXYZ';
const randomFolio = (taken: Set<string>): string => {
  for (let tries = 0; tries < 50; tries++) {
    let folio = '';
    for (let i = 0; i < 4; i++) folio += FOLIO_LETTERS[Math.floor(Math.random() * FOLIO_LETTERS.length)];
    if (!taken.has(folio)) return folio;
  }
  return Math.random().toString(36).slice(2, 7).toUpperCase();
};

// waiverAccepted: el cliente marcó que acepta el deslinde (el servidor lo exige si el negocio lo pide)
// Regresa el id de la cita y su folio (el folio queda vacío si no se pudo leer; la cita sí se guardó).
export const createBooking = async (
  businessId: string,
  booking: Omit<Booking, 'id' | 'createdAt'>,
  waiverAccepted = false
): Promise<{ id: string; folio?: string }> => {
  if (isSupabaseEnabled()) {
    // El precio y la duración los calcula el servidor a partir de los servicios elegidos
    const id = await supabaseRequest<string>('/rest/v1/rpc/create_booking', {
      method: 'POST',
      body: {
        p_business: businessId,
        p_name: booking.customerName,
        p_phone: booking.customerPhone,
        p_service_ids: booking.selectedServices.map(s => s.id),
        p_date: toDateString(new Date(booking.date)),
        p_time_slot: booking.timeSlot,
        p_location: booking.locationId || null,
        p_waiver: waiverAccepted,
        p_professional: booking.professionalId || null
      }
    });
    // El folio lo genera la base de datos: se lee de la cita recién creada
    let folio: string | undefined;
    try {
      const mine = await getMyBookings(businessId, booking.customerPhone);
      folio = mine.find(b => b.id === id)?.folio;
    } catch (e) {
      console.error('No se pudo leer el folio de la cita', e);
    }
    return { id, folio };
  }

  const bookings = await getBookings(businessId);

  // Límite de citas próximas por celular (igual que en la base de datos)
  const { maxBookingsPerPhone } = await getBusinessSettings(businessId);
  const today = toDateString(new Date());
  const upcoming = bookings.filter(
    b => lastTenDigits(b.customerPhone) === lastTenDigits(booking.customerPhone) && toDateString(new Date(b.date)) >= today
  ).length;
  if (upcoming >= maxBookingsPerPhone) throw new Error('too_many_bookings');

  const id = Math.random().toString(36).substr(2, 9);
  const createdAt = new Date().toISOString();

  const folio = randomFolio(new Set(bookings.map(b => b.folio || '')));

  const newBooking: Booking = {
    ...booking,
    id,
    createdAt,
    waiverAcceptedAt: waiverAccepted ? createdAt : null,
    folio,
    status: 'pending'
  };

  bookings.push(newBooking);
  saveToStorage(storageKey('bookings', businessId), bookings);
  return { id, folio };
};

// El negocio confirma una cita (o la regresa a pendiente)
export const setBookingStatus = async (businessId: string, id: string, status: BookingStatus): Promise<void> => {
  if (isSupabaseEnabled()) {
    await mutate(`/rest/v1/bookings?id=eq.${id}&business_id=eq.${businessId}`, 'PATCH', { status });
    return;
  }

  const bookings = await getBookings(businessId);
  saveToStorage(storageKey('bookings', businessId), bookings.map(b => (b.id === id ? { ...b, status } : b)));
};

export const deleteBooking = async (businessId: string, id: string): Promise<void> => {
  if (isSupabaseEnabled()) {
    await mutate(`/rest/v1/bookings?id=eq.${id}&business_id=eq.${businessId}`, 'DELETE');
    return;
  }

  const bookings = await getBookings(businessId);
  saveToStorage(storageKey('bookings', businessId), bookings.filter(b => b.id !== id));
};

// ---------------------------------------------------------------
// Mis reservas (el cliente ve y cancela sus propias citas con su celular)
// ---------------------------------------------------------------

// Citas de hoy en adelante de un celular en este negocio. No incluye nombre ni teléfono.
export const getMyBookings = async (businessId: string, phone: string): Promise<MyBooking[]> => {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>('/rest/v1/rpc/get_my_tickets', {
      method: 'POST',
      body: { p_business: businessId, p_phone: phone }
    });
    return rows.map(row => ({
      id: row.id,
      date: dateStringToIso(row.booking_date),
      timeSlot: row.time_slot,
      services: Array.isArray(row.services) ? row.services : [],
      totalPrice: row.total_price,
      totalDuration: row.total_duration,
      locationId: row.location_id ?? null,
      locationName: row.location_name || undefined,
      locationAddress: row.location_address || undefined,
      locationMapsUrl: row.location_maps_url || undefined,
      folio: row.folio || undefined,
      waiverAccepted: row.waiver_accepted === true,
      professionalId: row.professional_id ?? null,
      professionalName: row.professional_name || undefined,
      status: row.status === 'confirmed' ? 'confirmed' : 'pending'
    }));
  }

  // Modo demo: se busca en las citas guardadas en este navegador
  if (lastTenDigits(phone).length < 10) throw new Error('invalid_phone');
  const today = toDateString(new Date());
  return getFromStorage<Booking[]>(storageKey('bookings', businessId), [])
    .filter(b => lastTenDigits(b.customerPhone) === lastTenDigits(phone) && toDateString(new Date(b.date)) >= today)
    .sort((a, b) => toDateString(new Date(a.date)).localeCompare(toDateString(new Date(b.date))) || a.timeSlot.localeCompare(b.timeSlot))
    .map(b => ({
      id: b.id,
      date: dateStringToIso(toDateString(new Date(b.date))),
      timeSlot: b.timeSlot,
      services: b.selectedServices,
      totalPrice: b.totalPrice,
      totalDuration: b.totalDuration,
      folio: b.folio,
      waiverAccepted: !!b.waiverAcceptedAt,
      locationId: b.locationId ?? null,
      professionalId: b.professionalId ?? null,
      professionalName: b.professionalName,
      status: b.status === 'confirmed' ? 'confirmed' : 'pending'
    }));
};

// Cancela una cita propia. Regresa true si se canceló y false si no se pudo
// (celular distinto, cita ya pasada o ya cancelada).
export const cancelMyBooking = async (businessId: string, id: string, phone: string): Promise<boolean> => {
  if (isSupabaseEnabled()) {
    const result = await supabaseRequest<boolean>('/rest/v1/rpc/cancel_my_booking', {
      method: 'POST',
      body: { p_business: businessId, p_booking_id: id, p_phone: phone }
    });
    return result === true;
  }

  const key = storageKey('bookings', businessId);
  const bookings = getFromStorage<Booking[]>(key, []);
  const remaining = bookings.filter(b => !(b.id === id && lastTenDigits(b.customerPhone) === lastTenDigits(phone)));
  if (remaining.length === bookings.length) return false;
  saveToStorage(key, remaining);
  return true;
};

// Cambia el día y la hora de una cita propia (mismos servicios y sucursal). El folio se conserva.
// Si el nuevo horario no se puede, la cita anterior queda como estaba. Errores: slot_taken, same_slot,
// booking_not_found, waiver_required, past_date, day_off, invalid_time, too_many_bookings, etc.
export const rescheduleMyBooking = async (
  businessId: string,
  id: string,
  phone: string,
  date: Date,
  timeSlot: string,
  waiverAccepted = false
): Promise<string> => {
  if (isSupabaseEnabled()) {
    return supabaseRequest<string>('/rest/v1/rpc/reschedule_my_booking', {
      method: 'POST',
      body: {
        p_business: businessId,
        p_booking_id: id,
        p_phone: phone,
        p_date: toDateString(date),
        p_time_slot: timeSlot,
        p_waiver: waiverAccepted
      }
    });
  }

  const key = storageKey('bookings', businessId);
  const bookings = getFromStorage<Booking[]>(key, []);
  const index = bookings.findIndex(b => b.id === id && lastTenDigits(b.customerPhone) === lastTenDigits(phone));
  if (index < 0) throw new Error('booking_not_found');
  if (toDateString(new Date(bookings[index].date)) === toDateString(date) && bookings[index].timeSlot === timeSlot) {
    throw new Error('same_slot');
  }
  // Al cambiar el horario, el negocio tiene que confirmarla otra vez
  bookings[index] = { ...bookings[index], date: date.toISOString(), timeSlot, status: 'pending' };
  saveToStorage(key, bookings);
  return id;
};

export const cleanupOldBookings = async (): Promise<void> => {
  // Pendiente: las citas pasadas podrían borrarse automáticamente
};

// ---------------------------------------------------------------
// Configuración del negocio (horario)
// ---------------------------------------------------------------

export const getBusinessSettings = async (businessId: string): Promise<BusinessSettings> => {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>(`/rest/v1/settings?business_id=eq.${businessId}&select=*`);
    return rows.length > 0 ? mapSettings(rows[0]) : DEFAULT_SETTINGS;
  }
  // Se mezcla con los valores por defecto por si lo guardado es de una versión anterior
  return { ...DEFAULT_SETTINGS, ...getFromStorage<Partial<BusinessSettings>>(storageKey('settings', businessId), {}) };
};

export const saveBusinessSettings = async (businessId: string, settings: BusinessSettings): Promise<void> => {
  if (isSupabaseEnabled()) {
    await mutate(`/rest/v1/settings?business_id=eq.${businessId}`, 'PATCH', {
      work_start: settings.workStartTime,
      work_end: settings.workEndTime,
      break_start: settings.breakStartTime,
      break_end: settings.breakEndTime,
      off_days: settings.offDays,
      slot_interval: settings.slotInterval,
      max_bookings_per_phone: settings.maxBookingsPerPhone,
      capacity: settings.capacity,
      waiver_enabled: settings.waiverEnabled,
      waiver_text: settings.waiverText
    });
    return;
  }
  saveToStorage(storageKey('settings', businessId), settings);
};

// ---------------------------------------------------------------
// Sucursales (locales de un negocio)
// ---------------------------------------------------------------

// Todas las sucursales del negocio (también las ocultas), en el orden en que se muestran.
// Si todavía no tiene sucursales regresa una lista vacía y el negocio funciona como un solo lugar.
export const getLocations = async (businessId: string): Promise<BusinessLocation[]> => {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>(
      `/rest/v1/locations?business_id=eq.${businessId}&select=*&order=sort_order.asc,created_at.asc`
    );
    return rows.map(mapLocation);
  }
  return getFromStorage<BusinessLocation[]>(storageKey('locations', businessId), []);
};

// Crea una sucursal (sin id) o actualiza una que ya existe. Las sucursales no se borran: se ocultan (active = false).
export const saveLocation = async (
  businessId: string,
  location: Omit<BusinessLocation, 'id' | 'sortOrder'> & { id?: string; sortOrder?: number }
): Promise<void> => {
  if (isSupabaseEnabled()) {
    const body: Record<string, unknown> = {
      name: location.name,
      address: location.address,
      maps_url: location.mapsUrl,
      capacity: location.capacity,
      work_start: location.workStartTime,
      work_end: location.workEndTime,
      break_start: location.breakStartTime,
      break_end: location.breakEndTime,
      off_days: location.offDays,
      slot_interval: location.slotInterval,
      active: location.active
    };

    if (location.id && isUuid(location.id)) {
      await mutate(`/rest/v1/locations?id=eq.${location.id}&business_id=eq.${businessId}`, 'PATCH', body);
    } else {
      const existing = await getLocations(businessId);
      body.business_id = businessId;
      body.sort_order = existing.length + 1;
      await supabaseRequest('/rest/v1/locations', {
        method: 'POST',
        body,
        asAdmin: true,
        prefer: 'return=minimal'
      });
    }
    return;
  }

  const list = await getLocations(businessId);
  const index = list.findIndex(l => l.id === location.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...location, id: list[index].id };
  } else {
    list.push({ ...location, id: Math.random().toString(36).substr(2, 9), sortOrder: list.length + 1 });
  }
  saveToStorage(storageKey('locations', businessId), list);
};

// ---------------------------------------------------------------
// Profesionales (barberos, instructoras, doctores...)
// ---------------------------------------------------------------

// Todos los profesionales del negocio (también los ocultos), en el orden en que se muestran.
// Si todavía no tiene, regresa una lista vacía y el negocio funciona como siempre (sin elegir con quién).
export const getProfessionals = async (businessId: string): Promise<Professional[]> => {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>(
      `/rest/v1/professionals?business_id=eq.${businessId}&select=*&order=sort_order.asc,created_at.asc`
    );
    return rows.map(mapProfessional);
  }
  return getFromStorage<Professional[]>(storageKey('professionals', businessId), []);
};

// Crea un profesional (sin id) o actualiza uno que ya existe. No se borran: se ocultan (active = false)
// para no perder el historial de sus citas.
export const saveProfessional = async (
  businessId: string,
  pro: Omit<Professional, 'id' | 'sortOrder'> & { id?: string; sortOrder?: number }
): Promise<void> => {
  if (isSupabaseEnabled()) {
    const body: Record<string, unknown> = {
      name: pro.name,
      title: pro.title,
      photo_url: pro.photoUrl,
      location_id: pro.locationId || null,
      work_start: pro.workStartTime,
      work_end: pro.workEndTime,
      break_start: pro.breakStartTime,
      break_end: pro.breakEndTime,
      off_days: pro.offDays,
      active: pro.active
    };

    if (pro.id && isUuid(pro.id)) {
      await mutate(`/rest/v1/professionals?id=eq.${pro.id}&business_id=eq.${businessId}`, 'PATCH', body);
    } else {
      const existing = await getProfessionals(businessId);
      body.business_id = businessId;
      body.sort_order = existing.length + 1;
      await supabaseRequest('/rest/v1/professionals', {
        method: 'POST',
        body,
        asAdmin: true,
        prefer: 'return=minimal'
      });
    }
    return;
  }

  const list = await getProfessionals(businessId);
  const index = list.findIndex(p => p.id === pro.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...pro, id: list[index].id };
  } else {
    list.push({ ...pro, id: Math.random().toString(36).substr(2, 9), sortOrder: list.length + 1 });
  }
  saveToStorage(storageKey('professionals', businessId), list);
};
