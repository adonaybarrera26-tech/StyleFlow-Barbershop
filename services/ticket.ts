import { MyBooking } from '../types';
import { formatMXN, formatTime, getDateParts } from './format';

// Todo lo que el ticket de la cita necesita además de la cita misma
export interface TicketContext {
  businessName: string;
  address: string; // dirección del lugar de la cita (la de la sucursal, si la hay)
}

// "2026-11-27T12:00:00" -> fecha local (sin correrse de día por la zona horaria)
const ticketDay = (t: MyBooking): Date => {
  const [y, m, d] = t.date.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Inicio y fin de la cita en hora local
const ticketRange = (t: MyBooking): { start: Date; end: Date } => {
  const day = ticketDay(t);
  const [h, min] = t.timeSlot.split(':').map(Number);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min);
  const end = new Date(start.getTime() + Math.max(t.totalDuration || 0, 30) * 60000);
  return { start, end };
};

// "hoy", "mañana", "el jueves" o "el 3 de diciembre", según qué tan cerca sea la cita
export const relativeDayText = (t: MyBooking, now: Date = new Date()): string => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((ticketDay(t).getTime() - today.getTime()) / 86400000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days < 7) return `el ${getDateParts(ticketDay(t)).weekday.toLowerCase()}`;
  const parts = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' }).format(ticketDay(t));
  return `el ${parts}`;
};

// Mensajes de WhatsApp para el negocio (no llevan el nombre: la persona ya escribe desde su WhatsApp)
export const buildConfirmMessage = (t: MyBooking, businessName: string, customerName?: string): string => {
  const { weekday, full } = getDateParts(ticketDay(t));
  return (
    `Hola${customerName ? `, soy ${customerName}` : ''}. Acabo de reservar una cita en ${businessName}:\n` +
    (t.folio ? `• Folio: ${t.folio}\n` : '') +
    (t.locationName ? `• Sucursal: ${t.locationName}\n` : '') +
    `• Fecha: ${weekday}, ${full}\n` +
    `• Hora: ${formatTime(t.timeSlot)}\n` +
    `• Servicios: ${t.services.map(s => s.title).join(', ')}\n` +
    `• Total: ${formatMXN(t.totalPrice)}\n` +
    `Quedo atento a su confirmación. ¡Gracias!`
  );
};

export const buildCancelMessage = (t: MyBooking, businessName: string): string => {
  const { weekday, full } = getDateParts(ticketDay(t));
  return (
    `Hola, cancelé mi cita en ${businessName}:\n` +
    (t.folio ? `• Folio: ${t.folio}\n` : '') +
    (t.locationName ? `• Sucursal: ${t.locationName}\n` : '') +
    `• Fecha: ${weekday}, ${full}\n` +
    `• Hora: ${formatTime(t.timeSlot)}\n` +
    `• Servicios: ${t.services.map(s => s.title).join(', ')}\n` +
    `Gracias por su atención.`
  );
};

// "Jueves, 26 de noviembre de 2026" de una cita
export const ticketDateText = (t: MyBooking): string => {
  const { weekday, full } = getDateParts(ticketDay(t));
  return `${weekday}, ${full}`;
};

// ---------------------------------------------------------------
// Agregar al calendario (archivo .ics)
// ---------------------------------------------------------------

const icsText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const icsLocal = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
};

// Las líneas de un .ics no pasan de 75 caracteres: las largas se parten y la siguiente empieza con un espacio
const icsFold = (line: string): string => {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73));
    rest = ' ' + rest.slice(73);
  }
  parts.push(rest);
  return parts.join('\r\n');
};

export const buildIcs = (t: MyBooking, ctx: TicketContext): string => {
  const { start, end } = ticketRange(t);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const description =
    `Servicios: ${t.services.map(s => s.title).join(', ')}` +
    (t.folio ? `\nFolio: ${t.folio}` : '') +
    `\nTotal a pagar en el local: ${formatMXN(t.totalPrice)}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Balam Logic//Citas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${(t.folio || t.id)}-${icsLocal(start)}@balamlogic`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsLocal(start)}`,
    `DTEND:${icsLocal(end)}`,
    `SUMMARY:${icsText(`Cita en ${ctx.businessName}`)}`,
    `LOCATION:${icsText(ctx.address)}`,
    `DESCRIPTION:${icsText(description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Tu cita es mañana',
    'TRIGGER:-P1D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Tu cita es en una hora',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.map(icsFold).join('\r\n') + '\r\n';
};

// Descarga un archivo desde el navegador
const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export const downloadIcs = (t: MyBooking, ctx: TicketContext): void => {
  const blob = new Blob([buildIcs(t, ctx)], { type: 'text/calendar;charset=utf-8' });
  downloadBlob(blob, `cita-${t.folio || 'reserva'}.ics`);
};

// ---------------------------------------------------------------
// Guardar el ticket como imagen
// ---------------------------------------------------------------

const cssVar = (name: string, fallback: string): string => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

// "242 183 5" (como se guardan los colores del tema) -> "rgb(242 183 5)"
const themeColor = (name: string, fallback: string, alpha?: number): string => {
  const v = cssVar(name, fallback);
  return alpha === undefined ? `rgb(${v})` : `rgb(${v} / ${alpha})`;
};

// Parte un texto en líneas que quepan en el ancho dado
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

// Dibuja letras con espacio entre ellas (el folio se lee mejor así)
const drawSpaced = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number): number => {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + gap;
  }
  return cursor - gap;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Dibuja el ticket con los colores y las letras del negocio y regresa la imagen (PNG)
export const buildTicketImage = async (t: MyBooking, ctx2: TicketContext): Promise<Blob> => {
  try {
    await document.fonts.ready;
  } catch (e) {
    // sin lista de fuentes: se dibuja con la que haya
  }

  const display = cssVar('--font-display', 'Impact, sans-serif');
  const body = cssVar('--font-body', 'system-ui, sans-serif');
  const bg = themeColor('--slate-950', '11 10 8');
  const card = themeColor('--slate-900', '21 19 15');
  const line = themeColor('--slate-700', '58 51 38');
  const text = themeColor('--slate-100', '241 232 208');
  const muted = themeColor('--slate-400', '168 159 138');
  const accent = themeColor('--accent-500', '242 183 5');
  const onAccent = themeColor('--on-accent', '11 10 8');

  const W = 1080;
  const cardX = 60;
  const cardW = W - 120;
  const cardY = 60;
  const left = cardX + 76;
  const inner = cardW - 152;

  const { weekday, full } = getDateParts(ticketDay(t));
  const rows: Array<[string, string]> = [];
  if (t.locationName) rows.push(['Sucursal', t.locationName]);
  rows.push(['Fecha', `${weekday}, ${full}`]);
  rows.push(['Hora', formatTime(t.timeSlot)]);
  rows.push(['Servicios', t.services.map(s => s.title).join(', ')]);
  rows.push(['Total a pagar en el local', formatMXN(t.totalPrice)]);
  if (ctx2.address) rows.push(['Dirección', ctx2.address]);

  // Se dibuja una vez para medir cuánto ocupa y otra con el alto justo
  const paint = (c: CanvasRenderingContext2D, H: number): number => {
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.setLineDash([]);

    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    c.fillStyle = card;
    roundRect(c, cardX, cardY, cardW, H - 120, 36);
    c.fill();

    // Banda con el nombre del negocio
    c.save();
    roundRect(c, cardX, cardY, cardW, H - 120, 36);
    c.clip();
    c.fillStyle = accent;
    c.fillRect(cardX, cardY, cardW, 170);
    c.restore();

    c.fillStyle = onAccent;
    let nameSize = 76;
    c.font = `400 ${nameSize}px ${display}`;
    while (c.measureText(ctx2.businessName).width > cardW - 120 && nameSize > 36) {
      nameSize -= 4;
      c.font = `400 ${nameSize}px ${display}`;
    }
    c.textAlign = 'center';
    c.fillText(ctx2.businessName, W / 2, cardY + 108);

    // Folio
    let y = cardY + 170 + 80;
    c.fillStyle = muted;
    c.font = `600 32px ${body}`;
    c.fillText('FOLIO DE TU CITA', W / 2, y);
    y += 175;
    c.fillStyle = accent;
    c.font = `400 140px ${display}`;
    const folio = t.folio || '----';
    const gap = 30;
    let folioWidth = -gap;
    for (const ch of folio) folioWidth += c.measureText(ch).width + gap;
    c.textAlign = 'left';
    drawSpaced(c, folio, (W - folioWidth) / 2, y, gap);
    y += 80;

    // Línea de corte con muescas
    c.fillStyle = bg;
    c.beginPath();
    c.arc(cardX, y, 30, 0, Math.PI * 2);
    c.arc(cardX + cardW, y, 30, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = line;
    c.lineWidth = 4;
    c.setLineDash([16, 14]);
    c.beginPath();
    c.moveTo(cardX + 50, y);
    c.lineTo(cardX + cardW - 50, y);
    c.stroke();
    c.setLineDash([]);
    y += 100;

    // Datos de la cita
    for (const [label, value] of rows) {
      c.fillStyle = muted;
      c.font = `500 32px ${body}`;
      c.fillText(label, left, y);
      y += 58;
      c.fillStyle = text;
      c.font = `700 44px ${body}`;
      const valueLines = wrapText(c, value, inner);
      valueLines.forEach((l, i) => c.fillText(l, left, y + i * 54));
      y += (valueLines.length - 1) * 54 + 74;
    }

    // Pie
    c.fillStyle = muted;
    c.font = `500 34px ${body}`;
    c.textAlign = 'center';
    y += 36;
    c.fillText('Muestra este ticket al llegar. ¡Te esperamos!', W / 2, y);
    return y;
  };

  const probe = document.createElement('canvas');
  probe.width = W;
  probe.height = 4000;
  const endY = paint(probe.getContext('2d') as CanvasRenderingContext2D, 4000);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = endY + 100;
  paint(canvas.getContext('2d') as CanvasRenderingContext2D, canvas.height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('image_failed'))), 'image/png');
  });
};

// Guarda el ticket como imagen: en el celular abre el menú de compartir (Fotos, WhatsApp...) y,
// si el navegador no puede, la descarga.
export const saveTicketImage = async (t: MyBooking, ctx: TicketContext): Promise<'shared' | 'downloaded'> => {
  const blob = await buildTicketImage(t, ctx);
  const fileName = `ticket-${t.folio || 'cita'}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };

  if (nav.canShare && nav.canShare({ files: [file] }) && typeof nav.share === 'function') {
    try {
      await nav.share({ files: [file], title: `Cita en ${ctx.businessName}` });
      return 'shared';
    } catch (e) {
      // Si la persona cerró el menú, no se descarga nada
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
};
