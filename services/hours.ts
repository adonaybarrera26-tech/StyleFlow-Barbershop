import { formatTime } from './format';
import { Schedule } from './slots';

const SHORT_DAYS: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 0: 'Dom' };
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // la semana empieza en lunes

// Días que se abre, en palabras cortas: "Lun a Sáb", "Mar a Dom", "Lun, Mié y Vie"
export const describeOpenDays = (offDays: number[]): string => {
  const open = WEEK_ORDER.filter(d => !offDays.includes(d));
  if (open.length === 0) return 'Cerrado';
  if (open.length === 7) return 'Todos los días';

  // Se juntan los días seguidos: [1,2,3,4,5] -> "Lun a Vie"
  const runs: number[][] = [];
  for (const day of open) {
    const last = runs[runs.length - 1];
    if (last && WEEK_ORDER.indexOf(day) === WEEK_ORDER.indexOf(last[last.length - 1]) + 1) last.push(day);
    else runs.push([day]);
  }
  const parts = runs.map(run =>
    run.length >= 3 ? `${SHORT_DAYS[run[0]]} a ${SHORT_DAYS[run[run.length - 1]]}` : run.map(d => SHORT_DAYS[d]).join(' y ')
  );
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0];
};

// "Lun a Sáb · 10:00 a.m. a 8:00 p.m." (y el descanso, si lo hay)
export const describeHours = (schedule: Schedule): { line: string; breakLine: string } => {
  const days = describeOpenDays(schedule.offDays);
  if (days === 'Cerrado') return { line: days, breakLine: '' };
  return {
    line: `${days} · ${formatTime(schedule.workStartTime)} a ${formatTime(schedule.workEndTime)}`,
    breakLine:
      schedule.breakStartTime && schedule.breakEndTime
        ? `Descanso de ${formatTime(schedule.breakStartTime)} a ${formatTime(schedule.breakEndTime)}`
        : ''
  };
};
