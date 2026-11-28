import React from 'react';
import { Bell, MessageCircle, CheckCircle2 } from 'lucide-react';
import { Booking, BusinessLocation, Professional } from '../../types';
import { buildReminderMessage } from '../../services/ticket';
import { buildCustomerWhatsAppLink, formatTime } from '../../services/format';
import { localDay } from '../../services/customers';
import StatusChip from '../../components/StatusChip';

interface Props {
  bookings: Booking[];
  businessName: string;
  businessUrl: string;
  locations: BusinessLocation[];
  professionals: Professional[];
  onRemind: (b: Booking) => void; // marca "recordado"
  onUndo: (b: Booking) => void; // quita la marca
}

const pad = (n: number): string => String(n).padStart(2, '0');
const dayString = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Citas de hoy (que aún no pasan) y de mañana, para mandar el recordatorio por WhatsApp con un toque
const AdminReminders: React.FC<Props> = ({ bookings, businessName, businessUrl, locations, professionals, onRemind, onUndo }) => {
  const now = new Date();
  const today = dayString(now);
  const tomorrow = dayString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const due = bookings
    .filter(b => {
      const day = localDay(b.date);
      return day === tomorrow || (day === today && b.timeSlot > nowTime);
    })
    .sort((a, b) => localDay(a.date).localeCompare(localDay(b.date)) || a.timeSlot.localeCompare(b.timeSlot));

  const pending = due.filter(b => !b.remindedAt).length;

  const linkFor = (b: Booking): string => {
    const location = locations.find(l => l.id === b.locationId);
    return buildCustomerWhatsAppLink(
      b.customerPhone,
      buildReminderMessage(b, {
        when: localDay(b.date) === today ? 'hoy' : 'mañana',
        businessName,
        siteUrl: businessUrl,
        locationName: location?.name,
        locationAddress: location?.address,
        professionalName: professionals.find(p => p.id === b.professionalId)?.name
      })
    );
  };

  const groups: { label: string; items: Booking[] }[] = [
    { label: 'Hoy', items: due.filter(b => localDay(b.date) === today) },
    { label: 'Mañana', items: due.filter(b => localDay(b.date) === tomorrow) }
  ].filter(g => g.items.length > 0);

  return (
    <section className="bg-slate-900 rounded-xl border border-slate-800 p-4 sm:p-6 mb-6" aria-label="Recordatorios">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Bell size={20} className="text-amber-500" aria-hidden="true" /> Recordatorios
        </h2>
        {due.length > 0 && (
          <span className={`text-xs font-bold rounded-full px-3 py-1 border ${pending > 0 ? 'border-amber-500/30 bg-amber-500/10 text-amber-500' : 'border-green-500/30 bg-green-500/10 text-green-400'}`}>
            {pending > 0 ? `${pending} por mandar` : 'Todos mandados'}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-4">Toca “Recordar” y se abre WhatsApp con el mensaje listo; solo falta darle enviar.</p>

      {due.length === 0 ? (
        <p className="text-slate-400 text-sm">No hay citas para hoy ni para mañana.</p>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.label}>
              <h3 className="text-sm font-bold text-amber-500 mb-2">{group.label}</h3>
              <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                {group.items.map(b => (
                  <li key={b.id} className="p-3 sm:p-4 flex flex-wrap items-center gap-x-4 gap-y-3 bg-slate-900">
                    <div className="bg-slate-800 text-center py-1 px-2 rounded text-amber-500 font-bold border border-slate-700 whitespace-nowrap text-sm">
                      {formatTime(b.timeSlot)}
                    </div>
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="font-bold text-white truncate">{b.customerName}</p>
                      <p className="text-xs text-slate-400 truncate">{b.selectedServices.map(s => s.title).join(', ')}</p>
                    </div>
                    <StatusChip status={b.status} />
                    <div className="flex items-center gap-3">
                      {b.remindedAt ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-green-400">
                            <CheckCircle2 size={14} aria-hidden="true" /> Recordado
                          </span>
                          <a href={linkFor(b)} target="_blank" rel="noreferrer" className="text-xs text-slate-300 underline underline-offset-2 hover:text-white whitespace-nowrap">
                            Mandar otra vez
                          </a>
                          <button type="button" onClick={() => onUndo(b)} className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-300">
                            Deshacer
                          </button>
                        </>
                      ) : (
                        <a
                          href={linkFor(b)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => onRemind(b)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap bg-green-600 hover:bg-green-700 text-paper text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                        >
                          <MessageCircle size={14} aria-hidden="true" /> Recordar
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default AdminReminders;
