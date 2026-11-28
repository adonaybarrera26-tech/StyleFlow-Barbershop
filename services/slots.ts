import { BusinessLocation, BusinessSettings, Professional } from '../types';

// Horario, días de descanso y lugares por horario que rigen en una cita.
// Manda lo del profesional; lo que no define usa lo de la sucursal y, si tampoco, lo de la configuración general
// (igual que en la base de datos). Un profesional atiende a una persona a la vez.

export interface Schedule {
  workStartTime: string;
  workEndTime: string;
  breakStartTime: string | null;
  breakEndTime: string | null;
  offDays: number[];
  slotInterval: number;
  capacity: number;
}

export const effectiveSchedule = (
  location: BusinessLocation | null,
  settings: BusinessSettings,
  professional: Professional | null = null
): Schedule => {
  // Si el profesional (o la sucursal) tiene su horario, también tiene su propio descanso (que puede ser "sin descanso")
  const proHours = Boolean(professional && professional.workStartTime !== null);
  const locHours = Boolean(location && location.workStartTime !== null);

  let breakStartTime = settings.breakStartTime;
  let breakEndTime = settings.breakEndTime;
  if (proHours) {
    breakStartTime = professional!.breakStartTime;
    breakEndTime = professional!.breakEndTime;
  } else if (locHours) {
    breakStartTime = location!.breakStartTime;
    breakEndTime = location!.breakEndTime;
  }

  return {
    workStartTime: professional?.workStartTime ?? location?.workStartTime ?? settings.workStartTime,
    workEndTime: professional?.workEndTime ?? location?.workEndTime ?? settings.workEndTime,
    breakStartTime,
    breakEndTime,
    offDays: professional?.offDays ?? location?.offDays ?? settings.offDays,
    slotInterval: location?.slotInterval ?? settings.slotInterval,
    capacity: professional ? 1 : location?.capacity ?? settings.capacity ?? 1
  };
};

// "14:30" -> minutos desde la medianoche
export const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Horarios del día según apertura, cierre, descanso y cada cuánto se agenda
export const generateTimeSlots = (schedule: Schedule): string[] => {
  const slots: string[] = [];
  const end = toMinutes(schedule.workEndTime);
  const breakStart = schedule.breakStartTime && schedule.breakEndTime ? toMinutes(schedule.breakStartTime) : null;
  const breakEnd = schedule.breakStartTime && schedule.breakEndTime ? toMinutes(schedule.breakEndTime) : null;

  for (let t = toMinutes(schedule.workStartTime); t < end; t += schedule.slotInterval) {
    if (breakStart !== null && breakEnd !== null && t >= breakStart && t < breakEnd) continue;
    slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return slots;
};

// Lugares que quedan libres si alguien reserva de `start` a `start + needed` minutos.
// Se revisa el inicio y el inicio de cada cita que empieza durante esa franja:
// el peor momento decide (igual que lo valida la base de datos). 0 o menos = no hay lugar.
export const freeSpots = (
  start: number,
  needed: number,
  capacity: number,
  booked: { timeSlot: string; totalDuration: number }[],
  fallbackDuration: number
): number => {
  const end = start + needed;
  const spans = booked.map(b => {
    const from = toMinutes(b.timeSlot);
    return { from, to: from + (b.totalDuration || fallbackDuration) };
  });
  const points = [start, ...spans.map(s => s.from).filter(from => from > start && from < end)];
  let worst = 0;
  for (const t of points) {
    worst = Math.max(worst, spans.filter(s => s.from <= t && s.to > t).length);
  }
  return capacity - worst;
};
