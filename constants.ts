import { Business, BusinessSettings, Service } from './types';

// ============================================================
// NEGOCIO DE EJEMPLO (modo demo, sin base de datos)
// ============================================================
// Con base de datos (Supabase) cada negocio vive en la tabla "businesses"
// (ver supabase/schema.sql y el README) y estos datos NO se usan.
// Sin base de datos, la app muestra solo este negocio de ejemplo.
export const DEMO_BUSINESS: Business = {
  id: 'demo-barberia',
  slug: 'demo-barberia',
  name: 'StyleFlow Barbería',
  category: 'barberia',
  tagline: 'Corte fresco, flow real. Reserva tu cita en menos de un minuto.',
  // WhatsApp: lada del país + número, solo dígitos y sin espacios.
  // México: 52 + 10 dígitos. (Número de prueba)
  whatsappNumber: '525617527272',
  displayPhone: '56 1752 7272',
  // Dirección de ejemplo
  address: 'Calle Ejemplo 123, Col. Centro, Ciudad de México',
  // Link de Google Maps. En blanco, el botón "Cómo llegar" busca la dirección de arriba.
  mapsUrl: '',
  // Redes sociales de ejemplo (llevan a la página principal de cada red).
  // Si una queda en blanco ('') su botón no aparece en la portada.
  instagramUrl: 'https://www.instagram.com/',
  facebookUrl: 'https://www.facebook.com/',
  tiktokUrl: 'https://www.tiktok.com/',
  // Detalles que se muestran como etiquetas en la portada (vacío = se ocultan)
  perks: ['Cafecito de cortesía', 'Música a tu gusto', 'Toalla caliente en la barba'],
  // Look del negocio. En blanco, usa el tema de su giro y sin logo (ver services/themes.ts)
  theme: '',
  brandColor: '',
  logoUrl: '',
  // Promociones de la portada. Son informativas: el cliente las pide por WhatsApp
  // (el precio de la reserva en línea sigue siendo el normal). Vacío = se ocultan.
  promotions: [
    { id: 'lunes-corte', title: 'Lunes de corte', description: 'Corte de cabello con máquina y tijera', days: 'Solo los lunes', normalPrice: 150, promoPrice: 120 },
    { id: 'martes-barba', title: 'Martes de barbones', description: 'Corte de cabello y arreglo de barba', days: 'Solo los martes', normalPrice: 250, promoPrice: 210 },
  ],
};

// Quién ofrece el servicio: se ve al pie de la pantalla "Acerca de". Deja el nombre en blanco ('') para ocultarlo.
export const PLATFORM = {
  name: 'Balam Logic',
  url: 'https://balamlogic.com',
};

// Cómo se abre el sitio (se definen al publicar, con variables VITE_*):
//  - VITE_DEFAULT_BUSINESS: si se abre la raíz del sitio sin nombre de negocio, se manda a este negocio.
//    En blanco, se muestra una portada general.
//  - VITE_ROUTER=hash: direcciones con # (para GitHub Pages). Con un dominio propio, direcciones limpias.
export const DEFAULT_BUSINESS_SLUG: string = import.meta.env.VITE_DEFAULT_BUSINESS || '';
export const USE_HASH_ROUTER: boolean = import.meta.env.VITE_ROUTER === 'hash';

// Acceso al panel de administración (solo para demostración).
// Nota: al ser una app sin servidor, esta contraseña viaja en el código de la página.
export const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'barberia2026',
};

// Precios en pesos mexicanos (MXN)
export const INITIAL_SERVICES: Service[] = [
  { id: '1', title: 'Corte de cabello', price: 150, durationMinutes: 30, description: 'Clásico o moderno, con máquina y tijera' },
  { id: '2', title: 'Arreglo de barba', price: 100, durationMinutes: 20, description: 'Perfilado con navaja y toalla caliente' },
  { id: '3', title: 'Paquete novio', price: 800, durationMinutes: 120, description: 'Corte, barba, limpieza facial y peinado' },
  { id: '4', title: 'Limpieza facial', price: 250, durationMinutes: 45, description: 'Mascarilla negra y vapor caliente' },
];

export const DEFAULT_SETTINGS: BusinessSettings = {
  workStartTime: '10:00',
  workEndTime: '20:00',
  breakStartTime: null,
  breakEndTime: null,
  offDays: [0], // Domingo (en JavaScript getDay(): 0 = domingo, 1 = lunes ... 6 = sábado)
  slotInterval: 30,
  maxBookingsPerPhone: 3 // citas próximas que puede tener un mismo celular
};

// Base de datos en línea (Supabase).
// Si se dejan vacíos, la app funciona en "modo demo": guarda todo solo en el navegador.
// La llave pública (anon / publishable) es segura de publicar: la protegen las reglas de supabase/schema.sql.
export const SUPABASE_CONFIG = {
  url: 'https://hiyxtvjgcycltbmusfem.supabase.co',
  anonKey: 'sb_publishable_CCzzeqXSqsGYiy9VZuanHA_yn62TZqY' // Llave pública (publishable)
};
