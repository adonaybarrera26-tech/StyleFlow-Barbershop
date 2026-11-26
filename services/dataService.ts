import { Booking, MyBooking, Service, ShopSettings } from '../types';
import { INITIAL_SERVICES, DEFAULT_SETTINGS, ADMIN_CREDENTIALS } from '../constants';
import { lastTenDigits } from './format';
import { isSupabaseEnabled, supabaseRequest, signIn, signOut, getAccessToken, checkIsAdmin } from './supabase';

// La app tiene dos modos:
//  - Con Supabase (en línea): todos los datos se comparten entre todos los celulares.
//  - Sin Supabase (modo demo): los datos se guardan solo en el navegador de cada persona.

// ---------------------------------------------------------------
// Modo demo (LocalStorage)
// ---------------------------------------------------------------

// Claves de almacenamiento en el navegador
const STORAGE_KEYS = {
  SERVICES: 'styleflow_services',
  BOOKINGS: 'styleflow_bookings',
  SETTINGS: 'styleflow_settings'
};

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
  description: row.description || ''
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
  createdAt: row.created_at
});

const mapSettings = (row: any): ShopSettings => ({
  workStartTime: row.work_start,
  workEndTime: row.work_end,
  breakStartTime: row.break_start,
  breakEndTime: row.break_end,
  offDays: row.off_days || [],
  slotInterval: row.slot_interval,
  maxBookingsPerPhone: row.max_bookings_per_phone ?? DEFAULT_SETTINGS.maxBookingsPerPhone
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
// Sesión del administrador
// ---------------------------------------------------------------

// En modo en línea, "usuario" es el correo del administrador
export const loginAdmin = async (username: string, password: string): Promise<boolean> => {
  if (isSupabaseEnabled()) {
    const ok = await signIn(username.trim(), password);
    if (!ok) return false;
    if (!(await checkIsAdmin())) {
      await signOut();
      return false;
    }
    return true;
  }

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      sessionStorage.setItem('isAdmin', 'true');
      return true;
  }
  return false;
};

export const isAdminLoggedIn = async (): Promise<boolean> => {
  if (isSupabaseEnabled()) {
    return (await getAccessToken()) !== null;
  }
  return Boolean(sessionStorage.getItem('isAdmin'));
};

export const logoutAdmin = async (): Promise<void> => {
  sessionStorage.removeItem('isAdmin');
  if (isSupabaseEnabled()) {
    await signOut();
  }
};

// ---------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------

export const getServices = async (): Promise<Service[]> => {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>('/rest/v1/services?select=*&order=sort_order.asc,created_at.asc');
    return rows.map(mapService);
  }
  return getFromStorage<Service[]>(STORAGE_KEYS.SERVICES, INITIAL_SERVICES);
};

export const saveService = async (service: Service): Promise<void> => {
  if (isSupabaseEnabled()) {
    const body: Record<string, unknown> = {
      title: service.title,
      price: service.price,
      duration_minutes: service.durationMinutes,
      description: service.description || ''
    };

    if (isUuid(service.id)) {
      await mutate(`/rest/v1/services?id=eq.${service.id}`, 'PATCH', body);
    } else {
      // Servicio nuevo: la base de datos le asigna su id y lo manda al final de la lista
      const existing = await getServices();
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

  const services = await getServices();
  const index = services.findIndex(s => s.id === service.id);

  if (index >= 0) {
    services[index] = service;
  } else {
    services.push(service);
  }

  saveToStorage(STORAGE_KEYS.SERVICES, services);
};

export const deleteService = async (id: string): Promise<void> => {
  if (isSupabaseEnabled()) {
    if (isUuid(id)) {
      await mutate(`/rest/v1/services?id=eq.${id}`, 'DELETE');
    }
    return;
  }

  const services = await getServices();
  const filtered = services.filter(s => s.id !== id);
  saveToStorage(STORAGE_KEYS.SERVICES, filtered);
};

// ---------------------------------------------------------------
// Citas
// ---------------------------------------------------------------

// Todas las citas con datos de clientes (solo para el administrador)
export const getBookings = async (): Promise<Booking[]> => {
  let bookings: Booking[];

  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>(
      '/rest/v1/bookings?select=*&order=booking_date.asc,time_slot.asc',
      { asAdmin: true }
    );
    bookings = rows.map(mapBooking);
  } else {
    bookings = getFromStorage<Booking[]>(STORAGE_KEYS.BOOKINGS, []);
  }

  // Ordenar de la más reciente a la más antigua
  return bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// Horarios ocupados, SIN nombres ni celulares (para la pantalla de reservas de los clientes)
export const getTakenSlots = async (): Promise<Booking[]> => {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>('/rest/v1/rpc/get_taken_slots', {
      method: 'POST',
      body: { p_from: toDateString(new Date()) }
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
      createdAt: ''
    }));
  }
  return getBookings();
};

export const createBooking = async (booking: Omit<Booking, 'id' | 'createdAt'>): Promise<string> => {
  if (isSupabaseEnabled()) {
    // El precio y la duración los calcula el servidor a partir de los servicios elegidos
    const id = await supabaseRequest<string>('/rest/v1/rpc/create_booking', {
      method: 'POST',
      body: {
        p_name: booking.customerName,
        p_phone: booking.customerPhone,
        p_service_ids: booking.selectedServices.map(s => s.id),
        p_date: toDateString(new Date(booking.date)),
        p_time_slot: booking.timeSlot
      }
    });
    return id;
  }

  const bookings = await getBookings();

  // Límite de citas próximas por celular (igual que en la base de datos)
  const { maxBookingsPerPhone } = await getShopSettings();
  const today = toDateString(new Date());
  const upcoming = bookings.filter(
    b => lastTenDigits(b.customerPhone) === lastTenDigits(booking.customerPhone) && toDateString(new Date(b.date)) >= today
  ).length;
  if (upcoming >= maxBookingsPerPhone) throw new Error('too_many_bookings');

  const id = Math.random().toString(36).substr(2, 9);
  const createdAt = new Date().toISOString();

  const newBooking: Booking = {
    ...booking,
    id,
    createdAt
  };

  bookings.push(newBooking);
  saveToStorage(STORAGE_KEYS.BOOKINGS, bookings);
  return id;
};

export const deleteBooking = async (id: string): Promise<void> => {
  if (isSupabaseEnabled()) {
    await mutate(`/rest/v1/bookings?id=eq.${id}`, 'DELETE');
    return;
  }

  const bookings = await getBookings();
  saveToStorage(STORAGE_KEYS.BOOKINGS, bookings.filter(b => b.id !== id));
};

// ---------------------------------------------------------------
// Mis reservas (el cliente ve y cancela sus propias citas con su celular)
// ---------------------------------------------------------------

// Citas de hoy en adelante de un celular. No incluye nombre ni teléfono.
export const getMyBookings = async (phone: string): Promise<MyBooking[]> => {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>('/rest/v1/rpc/get_my_bookings', {
      method: 'POST',
      body: { p_phone: phone }
    });
    return rows.map(row => ({
      id: row.id,
      date: dateStringToIso(row.booking_date),
      timeSlot: row.time_slot,
      services: Array.isArray(row.services) ? row.services : [],
      totalPrice: row.total_price,
      totalDuration: row.total_duration
    }));
  }

  // Modo demo: se busca en las citas guardadas en este navegador
  if (lastTenDigits(phone).length < 10) throw new Error('invalid_phone');
  const today = toDateString(new Date());
  return getFromStorage<Booking[]>(STORAGE_KEYS.BOOKINGS, [])
    .filter(b => lastTenDigits(b.customerPhone) === lastTenDigits(phone) && toDateString(new Date(b.date)) >= today)
    .sort((a, b) => toDateString(new Date(a.date)).localeCompare(toDateString(new Date(b.date))) || a.timeSlot.localeCompare(b.timeSlot))
    .map(b => ({
      id: b.id,
      date: dateStringToIso(toDateString(new Date(b.date))),
      timeSlot: b.timeSlot,
      services: b.selectedServices,
      totalPrice: b.totalPrice,
      totalDuration: b.totalDuration
    }));
};

// Cancela una cita propia. Regresa true si se canceló y false si no se pudo
// (celular distinto, cita ya pasada o ya cancelada).
export const cancelMyBooking = async (id: string, phone: string): Promise<boolean> => {
  if (isSupabaseEnabled()) {
    const result = await supabaseRequest<boolean>('/rest/v1/rpc/cancel_my_booking', {
      method: 'POST',
      body: { p_booking_id: id, p_phone: phone }
    });
    return result === true;
  }

  const bookings = getFromStorage<Booking[]>(STORAGE_KEYS.BOOKINGS, []);
  const remaining = bookings.filter(b => !(b.id === id && lastTenDigits(b.customerPhone) === lastTenDigits(phone)));
  if (remaining.length === bookings.length) return false;
  saveToStorage(STORAGE_KEYS.BOOKINGS, remaining);
  return true;
};

export const cleanupOldBookings = async (): Promise<void> => {
  // Pendiente: las citas pasadas podrían borrarse automáticamente
};

// ---------------------------------------------------------------
// Configuración de la barbería
// ---------------------------------------------------------------

export const getShopSettings = async (): Promise<ShopSettings> => {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest<any[]>('/rest/v1/settings?id=eq.1&select=*');
    return rows.length > 0 ? mapSettings(rows[0]) : DEFAULT_SETTINGS;
  }
  // Se mezcla con los valores por defecto por si lo guardado es de una versión anterior
  return { ...DEFAULT_SETTINGS, ...getFromStorage<Partial<ShopSettings>>(STORAGE_KEYS.SETTINGS, {}) };
};

export const saveShopSettings = async (settings: ShopSettings): Promise<void> => {
  if (isSupabaseEnabled()) {
    await mutate('/rest/v1/settings?id=eq.1', 'PATCH', {
      work_start: settings.workStartTime,
      work_end: settings.workEndTime,
      break_start: settings.breakStartTime,
      break_end: settings.breakEndTime,
      off_days: settings.offDays,
      slot_interval: settings.slotInterval,
      max_bookings_per_phone: settings.maxBookingsPerPhone
    });
    return;
  }
  saveToStorage(STORAGE_KEYS.SETTINGS, settings);
};
