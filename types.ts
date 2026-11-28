export interface Service {
  id: string;
  title: string;
  price: number;
  durationMinutes: number;
  description?: string;
  locationId?: string | null; // vacío = se ofrece en todas las sucursales; con valor, solo en esa
}

// Sucursal de un negocio. Lo que queda en blanco (null) usa lo de la configuración general.
export interface BusinessLocation {
  id: string;
  name: string;
  address: string;
  mapsUrl: string;
  capacity: number | null; // lugares por horario
  workStartTime: string | null;
  workEndTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  offDays: number[] | null;
  slotInterval: number | null;
  sortOrder: number;
  active: boolean;
}

// Profesional del negocio (barbero, instructora, doctor...): tiene su foto y su propia agenda.
// Lo que queda en blanco (null) usa lo de su sucursal o, si no, lo de la configuración general.
export interface Professional {
  id: string;
  name: string;
  title: string; // puesto o especialidad ("Barbero", "Fade y barba")
  photoUrl: string; // link completo (https://...), foto subida (data:image/...) o archivo de la app (demos/barbero.svg)
  locationId: string | null; // vacío = trabaja en todas las sucursales
  workStartTime: string | null;
  workEndTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  offDays: number[] | null;
  sortOrder: number;
  active: boolean;
}

// Promoción que se muestra en la portada (informativa: el cliente la pide por WhatsApp)
export interface Promotion {
  id: string;
  title: string;
  description: string;
  days?: string; // "Solo los lunes"
  normalPrice: number;
  promoPrice: number;
}

// Negocio que usa la app (barbería, spa, consultorio...). Sus datos vienen de la base de datos.
export interface Business {
  id: string; // sin base de datos (modo demo) es igual al slug
  slug: string; // el nombre que va en la dirección: .../<slug>
  name: string;
  category: string; // barberia, spa, dentista, nutriologo, medico, estetica, otro
  tagline: string;
  whatsappNumber: string; // lada del país + número, solo dígitos (México: 52 + 10 dígitos)
  displayPhone: string;
  address: string;
  mapsUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  perks: string[];
  promotions: Promotion[];
  theme: string; // en blanco = el tema de su giro (barberia, spa, clinica, natural o esencia)
  brandColor: string; // color principal de su marca, como #1A8F6B (en blanco = el del tema)
  logoUrl: string; // logo: link completo (https://...) o archivo de la app (demos/logo.svg)
}

// Estado de una cita: la confirma el negocio desde el panel
export type BookingStatus = 'pending' | 'confirmed';

export interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  selectedServices: Service[];
  totalPrice: number;
  totalDuration: number;
  date: string; // ISO String for date
  timeSlot: string; // "14:00"
  createdAt: string;
  locationId?: string | null; // sucursal de la cita (vacío = el negocio no tiene sucursales)
  waiverAcceptedAt?: string | null; // cuándo aceptó el deslinde (si el negocio lo pide)
  folio?: string; // código de 4 letras de la cita (ej. RDRY)
  professionalId?: string | null; // con quién es la cita (vacío = el negocio no tiene profesionales)
  professionalName?: string; // nombre del profesional, para mostrarlo sin buscarlo
  status?: BookingStatus; // pendiente (por defecto) o confirmada por el negocio
  remindedAt?: string | null; // cuándo se le mandó el recordatorio por WhatsApp (vacío = todavía no)
}

// Cita vista por el propio cliente en "Mis reservas": sin nombre ni teléfono
export interface MyBooking {
  id: string;
  date: string; // fecha local a las 12:00 (ISO sin zona)
  timeSlot: string; // "14:00"
  services: Service[];
  totalPrice: number;
  totalDuration: number;
  locationName?: string; // sucursal de la cita, si el negocio tiene sucursales
  locationId?: string | null;
  locationAddress?: string; // dirección de la sucursal
  locationMapsUrl?: string; // enlace de mapa de la sucursal
  folio?: string; // código de 4 letras de la cita (ej. RDRY)
  waiverAccepted?: boolean; // ya aceptó el deslinde al reservar
  professionalId?: string | null; // con quién es la cita
  professionalName?: string;
  status?: BookingStatus; // pendiente (por defecto) o confirmada por el negocio
}

// Lo que viaja a la pantalla del ticket (y de ahí a reagendar o cancelar)
export interface TicketState {
  ticket: MyBooking;
  phone: string; // celular con el que se reservó: con ese mismo se reagenda o cancela
  customerName?: string;
  rescheduled?: boolean; // true cuando la persona acaba de reagendar
  previous?: { date: string; timeSlot: string }; // día y hora que tenía la cita antes de reagendar
}

// Lo que viaja a la pantalla de reservar cuando se reagenda una cita
export interface RescheduleState {
  ticket: MyBooking;
  phone: string;
  customerName?: string;
}

export enum UserRole {
  GUEST = 'GUEST',
  ADMIN = 'ADMIN'
}

export interface GeneratedImage {
  url: string;
  prompt: string;
}

export interface BusinessSettings {
  workStartTime: string; // "10:00"
  workEndTime: string;   // "20:00"
  breakStartTime: string | null; // "13:00" or null
  breakEndTime: string | null;   // "14:00" or null
  offDays: number[]; // Array of day indexes (0=Sunday, 6=Saturday in JS? No, JS: 0=Sun, 6=Sat)
  slotInterval: number; // 30 minutes
  maxBookingsPerPhone: number; // citas próximas permitidas por celular (3 por defecto)
  capacity: number; // lugares por horario: cuántas citas pueden coincidir (1 = una a la vez)
  waiverEnabled: boolean; // si pide aceptar un deslinde antes de reservar
  waiverText: string; // texto del deslinde (en blanco = uno general)
}