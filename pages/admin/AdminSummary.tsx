import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Booking } from '../../types';
import { formatMXN, formatTime } from '../../services/format';

// Resumen del negocio para el administrador.
// Las gráficas son HTML y CSS simples (sin librerías) y usan un solo color: el dorado de la marca.

interface AdminSummaryProps {
  bookings: Booking[];
  onOpenBookings: () => void;
}

interface ChartItem {
  key: string;
  label: string;      // texto corto debajo de la columna
  sublabel?: string;  // segunda línea (opcional)
  value: number;
  title: string;      // texto del globo (ej. "mié 26 nov")
  isToday?: boolean;
}

const WEEKDAY_NARROW = new Intl.DateTimeFormat('es-MX', { weekday: 'narrow' });
const DATE_SHORT = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const MONTH_LONG = new Intl.DateTimeFormat('es-MX', { month: 'long' });

const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const citasText = (n: number): string => `${n} ${n === 1 ? 'cita' : 'citas'}`;

// Número redondo para el borde de arriba de la gráfica (siempre par, para que la mitad sea entera)
const niceTop = (max: number): number => Math.max(2, max % 2 === 0 ? max : max + 1);

// ---------------------------------------------------------------
// Gráfica de columnas con globo al pasar el dedo o el mouse
// ---------------------------------------------------------------

const ColumnChart: React.FC<{ items: ChartItem[]; ariaLabel: string }> = ({ items, ariaLabel }) => {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // En el celular, tocar fuera de la gráfica cierra el globo
  useEffect(() => {
    if (active === null) return;
    const close = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [active]);

  const max = Math.max(0, ...items.map(i => i.value));
  const top = niceTop(max);
  const peak = max > 0 ? items.findIndex(i => i.value === max) : -1;
  const n = items.length;

  // Posición del globo: pegado a los lados en las columnas de los extremos
  const tipStyle = (index: number): React.CSSProperties => {
    if (index < 2) return { left: `${(index / n) * 100}%` };
    if (index > n - 3) return { left: `${((index + 1) / n) * 100}%`, transform: 'translateX(-100%)' };
    return { left: `${((index + 0.5) / n) * 100}%`, transform: 'translateX(-50%)' };
  };

  return (
    <div ref={rootRef}>
      {showTable ? (
        <table className="w-full text-sm text-left">
          <thead className="text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-2 font-medium">Día u hora</th>
              <th className="py-2 font-medium text-right">Citas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {items.map(item => (
              <tr key={item.key}>
                <td className="py-2 text-slate-300 capitalize">{item.title}</td>
                <td className="py-2 text-right font-bold text-white">{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex gap-2" role="group" aria-label={ariaLabel}>
          {/* Eje vertical */}
          <div className="relative h-32 w-5 shrink-0 text-[11px] text-slate-500 text-right" aria-hidden="true">
            <span className="absolute right-0 -top-2">{top}</span>
            <span className="absolute right-0 top-1/2 -translate-y-1/2">{top / 2}</span>
            <span className="absolute right-0 -bottom-2">0</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="relative h-32">
              {/* Líneas de la cuadrícula */}
              <div className="absolute inset-x-0 top-0 border-t border-slate-800" aria-hidden="true" />
              <div className="absolute inset-x-0 top-1/2 border-t border-slate-800" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-0 border-t border-slate-700" aria-hidden="true" />

              {/* Columnas */}
              <div className="absolute inset-0 flex">
                {items.map((item, index) => {
                  const isActive = active === index;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      aria-label={`${item.title}: ${citasText(item.value)}`}
                      onClick={() => setActive(isActive ? null : index)}
                      onPointerEnter={e => { if (e.pointerType === 'mouse') setActive(index); }}
                      onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null); }}
                      onFocus={() => setActive(index)}
                      onBlur={() => setActive(null)}
                      className="group relative flex-1 h-full flex items-end justify-center focus-visible:outline-none"
                    >
                      {item.value > 0 && (
                        <span
                          className={`block w-full max-w-[24px] rounded-t-[4px] transition-colors ${isActive ? 'bg-amber-300' : 'bg-amber-500'}`}
                          style={{ height: `${(item.value / top) * 100}%` }}
                        />
                      )}
                      {/* Cuando no hay columna, igual se muestra el foco del teclado */}
                      <span
                        className="pointer-events-none absolute inset-0 border border-transparent group-focus-visible:border-amber-500"
                        aria-hidden="true"
                      />
                      {/* Número solo en la columna más alta */}
                      {index === peak && (
                        <span
                          className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] font-bold text-white"
                          style={{ bottom: `calc(${(item.value / top) * 100}% + 2px)` }}
                          aria-hidden="true"
                        >
                          {item.value}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Globo */}
              {active !== null && (
                <div
                  className="pointer-events-none absolute -top-1 -translate-y-full z-10 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 whitespace-nowrap shadow-xl"
                  style={tipStyle(active)}
                  role="status"
                >
                  <div className="font-bold text-white leading-tight">{citasText(items[active].value)}</div>
                  <div className="text-xs text-slate-400 capitalize">{items[active].title}</div>
                </div>
              )}
            </div>

            {/* Etiquetas del eje horizontal */}
            <div className="flex mt-2" aria-hidden="true">
              {items.map(item => (
                <div key={item.key} className="flex-1 min-w-0 flex flex-col items-center leading-none text-[11px] text-slate-500">
                  <span className={item.isToday ? 'text-amber-500 font-bold' : ''}>{item.sublabel ?? ''}</span>
                  <span
                    className={`mt-1 min-w-[1.25rem] px-0.5 py-0.5 rounded text-center ${
                      item.isToday ? 'bg-amber-500 text-black font-bold' : 'text-slate-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => { setShowTable(!showTable); setActive(null); }}
        className="mt-4 text-xs text-slate-400 hover:text-white underline underline-offset-2 transition-colors"
      >
        {showTable ? 'Ver gráfica' : 'Ver como tabla'}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------
// Tarjetas
// ---------------------------------------------------------------

const Card: React.FC<{ title: string; subtitle?: string; className?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  className = '',
  children
}) => (
  <section className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
    <h3 className="font-display uppercase tracking-wide text-xl text-white">{title}</h3>
    {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    <div className="mt-5">{children}</div>
  </section>
);

const StatTile: React.FC<{ label: string; value: string; note?: string; className?: string }> = ({
  label,
  value,
  note,
  className = ''
}) => (
  <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
    <p className="text-sm text-slate-400">{label}</p>
    <p className="font-display text-5xl leading-none text-white mt-3">{value}</p>
    {note && <p className="text-xs text-slate-500 mt-3">{note}</p>}
  </div>
);

// ---------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------

const AdminSummary: React.FC<AdminSummaryProps> = ({ bookings, onOpenBookings }) => {
  const summary = useMemo(() => {
    const now = new Date();
    const todayKey = dayKey(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const toMinutes = (slot: string) => {
      const [h, m] = slot.split(':').map(Number);
      return h * 60 + m;
    };

    // Hoy
    const todays = bookings
      .filter(b => dayKey(new Date(b.date)) === todayKey)
      .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    const nextToday = todays.find(b => toMinutes(b.timeSlot) >= nowMinutes);

    // Este mes
    const monthBookings = bookings.filter(b => {
      const d = new Date(b.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const revenue = monthBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const average = monthBookings.length > 0 ? Math.round(revenue / monthBookings.length) : 0;

    // Citas por día: 7 días antes, hoy y 7 días después
    const perDay = new Map<string, number>();
    bookings.forEach(b => {
      const k = dayKey(new Date(b.date));
      perDay.set(k, (perDay.get(k) || 0) + 1);
    });
    const dayItems: ChartItem[] = Array.from({ length: 15 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i - 7);
      const k = dayKey(d);
      return {
        key: k,
        sublabel: WEEKDAY_NARROW.format(d).toUpperCase(),
        label: String(d.getDate()),
        value: perDay.get(k) || 0,
        title: k === todayKey ? `hoy, ${DATE_SHORT.format(d)}` : DATE_SHORT.format(d),
        isToday: k === todayKey
      };
    });

    // Servicios más pedidos (todas las citas)
    const perService = new Map<string, number>();
    bookings.forEach(b => b.selectedServices.forEach(s => perService.set(s.title, (perService.get(s.title) || 0) + 1)));
    const topServices = Array.from(perService.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5);
    const totalServices = Array.from(perService.values()).reduce((sum, v) => sum + v, 0);

    // Horas más ocupadas (todas las citas), de la primera a la última hora con citas
    const perHour = new Map<number, number>();
    bookings.forEach(b => {
      const h = Number(b.timeSlot.split(':')[0]);
      perHour.set(h, (perHour.get(h) || 0) + 1);
    });
    const hours = Array.from(perHour.keys());
    const hourItems: ChartItem[] = [];
    if (hours.length > 0) {
      const first = Math.min(...hours);
      const last = Math.max(...hours);
      for (let h = first; h <= last; h++) {
        hourItems.push({
          key: String(h),
          label: String(h % 12 === 0 ? 12 : h % 12),
          sublabel: h < 12 ? 'a.m.' : 'p.m.',
          value: perHour.get(h) || 0,
          title: formatTime(`${String(h).padStart(2, '0')}:00`).replace(':00', '')
        });
      }
    }

    return {
      todays,
      nextToday,
      monthName: MONTH_LONG.format(now),
      monthCount: monthBookings.length,
      revenue,
      average,
      dayItems,
      topServices,
      totalServices,
      hourItems
    };
  }, [bookings]);

  if (bookings.length === 0) {
    return (
      <div className="bg-slate-900 rounded-xl p-12 text-center border border-slate-800 animate-in fade-in">
        <BarChart3 size={48} className="mx-auto text-slate-700 mb-4" />
        <p className="text-white text-lg font-bold">Todavía no hay citas</p>
        <p className="text-slate-500 mt-2 max-w-sm mx-auto">
          Cuando tus clientes reserven, aquí verás cuántas citas tienes hoy, cuánto llevas en el mes y qué servicios piden más.
        </p>
      </div>
    );
  }

  const { todays, nextToday, topServices, totalServices } = summary;
  const topCount = topServices.length > 0 ? topServices[0][1] : 0;

  let todayNote = 'No hay citas hoy.';
  if (todays.length > 0) {
    todayNote = nextToday
      ? `Siguiente: ${formatTime(nextToday.timeSlot)}, ${nextToday.customerName}`
      : 'Ya pasaron todas las citas de hoy.';
  }

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onOpenBookings}
          className="text-sm text-slate-400 hover:text-white underline underline-offset-2 transition-colors"
        >
          Ver todas las citas
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile
          className="col-span-2 md:col-span-1"
          label="Citas hoy"
          value={String(todays.length)}
          note={todayNote}
        />
        <StatTile
          label="Ingresos del mes"
          value={formatMXN(summary.revenue)}
          note={`${citasText(summary.monthCount)} en ${summary.monthName}`}
        />
        <StatTile
          label="Ticket promedio"
          value={summary.monthCount > 0 ? formatMXN(summary.average) : '—'}
          note="Lo que gasta cada cliente por cita"
        />
      </div>

      <Card title="Citas por día" subtitle="7 días antes y 7 días después de hoy">
        <ColumnChart items={summary.dayItems} ariaLabel="Citas por día" />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Servicios más pedidos" subtitle="Con todas las citas registradas">
          <ul className="space-y-4">
            {topServices.map(([title, count]) => (
              <li
                key={title}
                title={`${title}: ${count} de ${totalServices} servicios`}
              >
                <div className="text-sm text-slate-300 truncate">{title}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div
                    className="h-3 rounded-r-[4px] bg-amber-500"
                    style={{ width: `${Math.max((count / topCount) * 85, 3)}%` }}
                  />
                  <span className="text-sm font-bold text-white">{count}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Horas más ocupadas" subtitle="Hora de inicio de las citas, con todas las citas registradas">
          <ColumnChart items={summary.hourItems} ariaLabel="Citas por hora" />
        </Card>
      </div>
    </div>
  );
};

export default AdminSummary;
