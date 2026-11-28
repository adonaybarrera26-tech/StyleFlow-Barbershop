import React, { useMemo, useState } from 'react';
import { Search, MessageCircle, Download, User } from 'lucide-react';
import { Booking } from '../../types';
import {
  CustomerSegment,
  CustomerSummary,
  agoText,
  buildComeBackMessage,
  buildGreetingMessage,
  isLapsed,
  matchesCustomerSearch,
  matchesSegment,
  summarizeCustomers
} from '../../services/customers';
import { buildCustomerWhatsAppLink, formatMXN, formatTime } from '../../services/format';

const DAY_FORMAT = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const formatDay = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  return DAY_FORMAT.format(new Date(y, m - 1, d));
};

const SEGMENTS: { id: CustomerSegment; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'new', label: 'Nuevos' },
  { id: 'frequent', label: 'Frecuentes' },
  { id: 'lapsed', label: 'Sin venir' }
];

const LAPSED_OPTIONS = [30, 60, 90, 180];

// Lista de clientes del negocio: salen de las citas, agrupadas por celular
const AdminCustomers: React.FC<{ bookings: Booking[]; businessName: string; businessUrl: string; slug: string }> = ({
  bookings,
  businessName,
  businessUrl,
  slug
}) => {
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<CustomerSegment>('all');
  const [lapsedDays, setLapsedDays] = useState(30);

  const customers = useMemo(() => summarizeCustomers(bookings), [bookings]);
  const counts = useMemo(() => {
    const result = {} as Record<CustomerSegment, number>;
    SEGMENTS.forEach(s => {
      result[s.id] = customers.filter(c => matchesSegment(c, s.id, lapsedDays)).length;
    });
    return result;
  }, [customers, lapsedDays]);

  const list = customers.filter(c => matchesSegment(c, segment, lapsedDays) && matchesCustomerSearch(c, search));

  const exportExcel = async () => {
    // xlsx se carga solo cuando hace falta para no hacer pesada la app
    const XLSX = await import('xlsx');
    const rows = list.map(c => ({
      'Cliente': c.name,
      'Celular': c.phone,
      'Citas pasadas': c.pastCount,
      'Próxima cita': c.next ? `${formatDay(c.next.day)} ${formatTime(c.next.timeSlot)}` : '',
      'Última cita': c.lastPastDay ? formatDay(c.lastPastDay) : '',
      'Total gastado (MXN)': c.totalSpent
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, `${slug}_clientes.xlsx`);
  };

  const chip = 'rounded-full border px-2.5 py-1 whitespace-nowrap';

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="relative flex-1 min-w-[220px] sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar nombre o celular"
              aria-label="Buscar clientes por nombre o celular"
              className="bg-slate-800 text-slate-200 placeholder:text-slate-500 pl-9 pr-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500 w-full"
            />
          </div>
          <button
            onClick={exportExcel}
            disabled={list.length === 0}
            className="flex items-center gap-2 bg-green-700 text-paper px-4 py-2 rounded-lg hover:bg-green-600 transition-colors shadow-lg shadow-green-900/20 disabled:opacity-40"
          >
            <Download size={18} />
            Exportar clientes
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tipo de cliente">
          {SEGMENTS.map(s => (
            <button
              key={s.id}
              onClick={() => setSegment(s.id)}
              aria-pressed={segment === s.id}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                segment === s.id
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20 ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {s.label} ({counts[s.id]})
            </button>
          ))}
        </div>

        {segment === 'lapsed' && (
          <label className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            Última cita hace más de
            <select
              value={lapsedDays}
              onChange={e => setLapsedDays(Number(e.target.value))}
              className="bg-slate-800 text-slate-200 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500"
            >
              {LAPSED_OPTIONS.map(d => (
                <option key={d} value={d}>{d} días</option>
              ))}
            </select>
          </label>
        )}

        <p className="text-xs text-slate-500">
          Los clientes salen de sus citas y se agrupan por celular. <span className="text-slate-400">Nuevos:</span> una sola cita.{' '}
          <span className="text-slate-400">Frecuentes:</span> 3 o más citas pasadas.{' '}
          <span className="text-slate-400">Sin venir:</span> ya vinieron, no tienen cita próxima y pasó el tiempo que elijas.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="bg-slate-900 rounded-xl p-12 text-center border border-slate-800">
          <User size={48} className="mx-auto text-slate-700 mb-4" />
          <p className="text-slate-500 text-lg">
            {customers.length === 0 ? 'Todavía no hay clientes. Aparecen cuando alguien reserva.' : 'No hay clientes con ese filtro.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {list.map((c: CustomerSummary) => {
            const lapsed = isLapsed(c, lapsedDays);
            return (
              <li key={c.key} className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{c.name}</p>
                    <p className="text-slate-500 text-xs font-mono mt-0.5">{c.phone}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-200 whitespace-nowrap">
                    {c.pastCount > 0 ? `${c.pastCount} ${c.pastCount === 1 ? 'cita' : 'citas'}` : 'Nuevo'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {c.next && (
                    <span className={`${chip} border-amber-500/30 bg-amber-500/10 text-amber-500`}>
                      Próxima: {formatDay(c.next.day)} · {formatTime(c.next.timeSlot)}
                    </span>
                  )}
                  {c.daysSinceLast !== null && (
                    <span className={`${chip} border-slate-700 bg-slate-800 text-slate-300`}>Última: {agoText(c.daysSinceLast)}</span>
                  )}
                  {c.totalSpent > 0 && (
                    <span className={`${chip} border-slate-700 bg-slate-800 text-slate-300`}>{formatMXN(c.totalSpent)} en total</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildCustomerWhatsAppLink(c.phone, buildGreetingMessage(c, businessName))}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap border border-green-600 text-green-400 hover:bg-green-600/10 text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    <MessageCircle size={16} aria-hidden="true" /> Escribir
                  </a>
                  {lapsed && (
                    <a
                      href={buildCustomerWhatsAppLink(c.phone, buildComeBackMessage(c, businessName, `${businessUrl}/booking`))}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 whitespace-nowrap bg-green-600 hover:bg-green-700 text-paper text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                      <MessageCircle size={16} aria-hidden="true" /> Invitar a volver
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AdminCustomers;
