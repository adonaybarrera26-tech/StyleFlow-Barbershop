import { SHOP_INFO } from '../constants';

const LOCALE = 'es-MX';

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

// $1,200 (pesos mexicanos, sin centavos)
export const formatMXN = (amount: number): string =>
  new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0
  }).format(amount);

// "Jueves, 26 de noviembre de 2026"
export const formatDateLong = (date: Date): string =>
  capitalize(
    new Intl.DateTimeFormat(LOCALE, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date)
  );

// "Jueves" y "26 de noviembre de 2026" por separado
export const getDateParts = (date: Date) => ({
  weekday: capitalize(new Intl.DateTimeFormat(LOCALE, { weekday: 'long' }).format(date)),
  full: new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
});

// "26/11/2026"
export const formatDateShort = (date: Date): string =>
  new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);

// "26/11/2026 10:30 a.m."
export const formatDateTimeShort = (date: Date): string =>
  new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeStyle: 'short' }).format(date);

// Convierte "14:00" (formato guardado) en "2:00 p.m." (como se lee en México)
export const formatTime = (slot: string): string => {
  const [h, m] = slot.split(':').map(Number);
  const suffix = h < 12 ? 'a.m.' : 'p.m.';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
};

// Celular de México: 10 dígitos (acepta también con lada 52 o 521)
export const isValidMexicanPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return true;
  if (digits.length === 12 && digits.startsWith('52')) return true;
  if (digits.length === 13 && digits.startsWith('521')) return true;
  return false;
};

// Últimos 10 dígitos de un celular: así "55 1234 5678", "+52 55 1234 5678" y "521 55 1234 5678" son el mismo número
export const lastTenDigits = (phone: string): string => phone.replace(/\D/g, '').slice(-10);

// Enlace para abrir WhatsApp con un mensaje ya escrito
export const buildWhatsAppLink = (message: string): string =>
  `https://wa.me/${SHOP_INFO.whatsappNumber}?text=${encodeURIComponent(message)}`;

// Enlace para llamar por teléfono a la barbería
export const buildCallLink = (): string => `tel:+${SHOP_INFO.whatsappNumber}`;

// Enlace de Google Maps: el que se escribió en SHOP_INFO.mapsUrl o, si está en blanco, una búsqueda de la dirección
export const buildMapsLink = (): string =>
  SHOP_INFO.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SHOP_INFO.address)}`;

// Celular de un cliente en formato internacional para wa.me (México: 52 + 10 dígitos)
export const toWhatsAppNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `52${digits}`;
  if (digits.length === 13 && digits.startsWith('521')) return `52${digits.slice(3)}`;
  return digits; // ya trae la lada (52...) o es de otro país
};

// Enlace para escribirle a un cliente por WhatsApp con un mensaje ya escrito
export const buildCustomerWhatsAppLink = (phone: string, message: string): string =>
  `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`;

// Para insertar texto del usuario en HTML (ventana de impresión) sin riesgos
export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
