import { Booking } from '../types';
import { lastTenDigits } from './format';

// Clientes del negocio: salen de las citas, agrupadas por celular (no hay cuentas de cliente).

export interface CustomerSummary {
  key: string; // últimos 10 dígitos del celular
  name: string; // nombre con el que reservó la última vez
  phone: string;
  pastCount: number; // citas que ya pasaron
  upcomingCount: number; // citas de hoy en adelante
  totalSpent: number; // suma de las citas que ya pasaron
  lastPastDay: string | null; // "2026-11-20"
  next: { day: string; timeSlot: string } | null; // próxima cita
  daysSinceLast: number | null; // días desde la última cita que ya pasó
}

export type CustomerSegment = 'all' | 'new' | 'frequent' | 'lapsed';

const pad = (n: number): string => String(n).padStart(2, '0');

// Día local de una fecha ISO: "2026-11-28"
export const localDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Días entre dos días "aaaa-mm-dd" (sin errores por cambio de horario)
const daysBetween = (from: string, to: string): number => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
};

export const summarizeCustomers = (bookings: Booking[], now: Date = new Date()): CustomerSummary[] => {
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const groups = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = lastTenDigits(b.customerPhone || '');
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }

  const customers: CustomerSummary[] = [];
  groups.forEach((list, key) => {
    // El nombre y el celular que valen son los de la reserva más reciente
    const latest = list.reduce((a, b) => (new Date(b.createdAt).getTime() > new Date(a.createdAt).getTime() ? b : a));
    const past = list.filter(b => localDay(b.date) < today);
    const upcoming = list
      .filter(b => localDay(b.date) >= today)
      .sort((a, b) => localDay(a.date).localeCompare(localDay(b.date)) || a.timeSlot.localeCompare(b.timeSlot));
    const lastPastDay = past.length > 0 ? past.map(b => localDay(b.date)).sort().slice(-1)[0] : null;

    customers.push({
      key,
      name: latest.customerName,
      phone: latest.customerPhone,
      pastCount: past.length,
      upcomingCount: upcoming.length,
      totalSpent: past.reduce((sum, b) => sum + b.totalPrice, 0),
      lastPastDay,
      next: upcoming.length > 0 ? { day: localDay(upcoming[0].date), timeSlot: upcoming[0].timeSlot } : null,
      daysSinceLast: lastPastDay ? daysBetween(lastPastDay, today) : null
    });
  });

  // Primero quienes tienen cita próxima (la más cercana arriba); luego, por última cita (la más reciente arriba)
  return customers.sort((a, b) => {
    if (a.next && b.next) return a.next.day.localeCompare(b.next.day) || a.next.timeSlot.localeCompare(b.next.timeSlot);
    if (a.next) return -1;
    if (b.next) return 1;
    return (b.lastPastDay ?? '').localeCompare(a.lastPastDay ?? '');
  });
};

// "Sin venir": ya vino antes, no tiene cita próxima y su última cita fue hace más de N días
export const isLapsed = (c: CustomerSummary, lapsedDays: number): boolean =>
  c.pastCount >= 1 && c.upcomingCount === 0 && c.daysSinceLast !== null && c.daysSinceLast >= lapsedDays;

export const matchesSegment = (c: CustomerSummary, segment: CustomerSegment, lapsedDays: number): boolean => {
  switch (segment) {
    case 'new':
      return c.pastCount + c.upcomingCount === 1;
    case 'frequent':
      return c.pastCount >= 3;
    case 'lapsed':
      return isLapsed(c, lapsedDays);
    default:
      return true;
  }
};

export const matchesCustomerSearch = (c: CustomerSummary, search: string): boolean => {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  return c.name.toLowerCase().includes(q) || (digits.length >= 3 && c.key.includes(digits));
};

// "hoy", "ayer", "hace 12 días", "hace 2 meses"
export const agoText = (days: number): string => {
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
};

const firstName = (c: CustomerSummary): string => c.name.trim().split(/\s+/)[0];

// Mensajes de WhatsApp para el cliente (se abren con el texto ya escrito)
export const buildGreetingMessage = (c: CustomerSummary, businessName: string): string =>
  `Hola ${firstName(c)}, te escribimos de ${businessName}.`;

export const buildComeBackMessage = (c: CustomerSummary, businessName: string, bookingUrl: string): string =>
  `Hola ${firstName(c)}, te escribimos de ${businessName}. Hace tiempo no te vemos y nos encantaría atenderte de nuevo. ` +
  `Puedes reservar tu cita aquí: ${bookingUrl} ¡Te esperamos!`;
