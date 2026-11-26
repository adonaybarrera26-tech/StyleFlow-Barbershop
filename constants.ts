import { Service, ShopSettings } from './types';

// ============================================================
// DATOS DEL NEGOCIO — cambia aquí lo que quieras personalizar
// ============================================================
export const SHOP_INFO = {
  name: 'StyleFlow Barbería',
  tagline: 'Corte fresco, flow real. Reserva tu silla en menos de un minuto.',
  // WhatsApp: lada del país + número, solo dígitos y sin espacios.
  // México: 52 + 10 dígitos. (Número de prueba: cámbialo por el de la barbería)
  whatsappNumber: '525617527272',
  displayPhone: '56 1752 7272',
  // Dirección de ejemplo: cámbiala por la real
  address: 'Calle Ejemplo 123, Col. Centro, Ciudad de México',
};

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

export const DEFAULT_SETTINGS: ShopSettings = {
  workStartTime: '10:00',
  workEndTime: '20:00',
  breakStartTime: null,
  breakEndTime: null,
  offDays: [0], // Domingo (en JavaScript getDay(): 0 = domingo, 1 = lunes ... 6 = sábado)
  slotInterval: 30
};
