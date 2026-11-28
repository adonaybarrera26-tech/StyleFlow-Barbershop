import React, { useState } from 'react';
import { Plus, Edit2, MapPin, Eye, EyeOff, Users, Clock, Save } from 'lucide-react';
import { BusinessLocation, BusinessSettings } from '../../types';
import { saveLocation } from '../../services/dataService';
import { formatTime } from '../../services/format';

// id = número de día en JavaScript (0 = domingo ... 6 = sábado)
export const WEEK_DAYS = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' },
  { id: 0, label: 'Domingo' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

const inputClass =
  'w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-amber-500 outline-none';

// Lo que se edita en el formulario: lo que la sucursal deja "igual que el negocio" se guarda como vacío (null)
interface Draft {
  id?: string;
  name: string;
  address: string;
  mapsUrl: string;
  capacity: string; // '' = igual que la configuración general
  ownHours: boolean;
  workStartTime: string;
  workEndTime: string;
  breakStartTime: string;
  breakEndTime: string;
  ownOffDays: boolean;
  offDays: number[];
  slotInterval: number | null; // no se edita aquí: se conserva lo que ya tenga la sucursal
  active: boolean;
}

const emptyDraft = (settings: BusinessSettings): Draft => ({
  name: '',
  address: '',
  mapsUrl: '',
  capacity: '',
  ownHours: false,
  workStartTime: settings.workStartTime,
  workEndTime: settings.workEndTime,
  breakStartTime: settings.breakStartTime || '',
  breakEndTime: settings.breakEndTime || '',
  ownOffDays: false,
  offDays: settings.offDays,
  slotInterval: null,
  active: true,
});

const draftFrom = (l: BusinessLocation, settings: BusinessSettings): Draft => ({
  id: l.id,
  name: l.name,
  address: l.address,
  mapsUrl: l.mapsUrl,
  capacity: l.capacity === null ? '' : String(l.capacity),
  ownHours: l.workStartTime !== null,
  workStartTime: l.workStartTime ?? settings.workStartTime,
  workEndTime: l.workEndTime ?? settings.workEndTime,
  breakStartTime: (l.workStartTime !== null ? l.breakStartTime : settings.breakStartTime) || '',
  breakEndTime: (l.workStartTime !== null ? l.breakEndTime : settings.breakEndTime) || '',
  ownOffDays: l.offDays !== null,
  offDays: l.offDays ?? settings.offDays,
  slotInterval: l.slotInterval,
  active: l.active,
});

interface Props {
  businessId: string;
  locations: BusinessLocation[]; // todos, también los ocultos
  settings: BusinessSettings;
  onChanged: () => Promise<void> | void; // recargar la lista después de guardar
  onSuccess: (message: string) => void;
  onError: (error: unknown, message: string) => void;
}

const HourSelect: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}> = ({ id, label, value, onChange, allowEmpty }) => (
  <div>
    <label htmlFor={id} className="block text-slate-400 text-sm mb-2">{label}</label>
    <select id={id} value={value} onChange={e => onChange(e.target.value)} className={inputClass}>
      {allowEmpty && <option value="">Sin descanso</option>}
      {HOURS.map(t => (
        <option key={t} value={t}>{formatTime(t)}</option>
      ))}
    </select>
  </div>
);

const AdminLocations: React.FC<Props> = ({ businessId, locations, settings, onChanged, onSuccess, onError }) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const activeCount = locations.filter(l => l.active).length;

  const toBody = (d: Draft) => ({
    name: d.name.trim(),
    address: d.address.trim(),
    mapsUrl: d.mapsUrl.trim(),
    capacity: d.capacity === '' ? null : Number(d.capacity),
    workStartTime: d.ownHours ? d.workStartTime : null,
    workEndTime: d.ownHours ? d.workEndTime : null,
    breakStartTime: d.ownHours && d.breakStartTime && d.breakEndTime ? d.breakStartTime : null,
    breakEndTime: d.ownHours && d.breakStartTime && d.breakEndTime ? d.breakEndTime : null,
    offDays: d.ownOffDays ? d.offDays : null,
    slotInterval: d.slotInterval,
    active: d.active,
  });

  const validate = (d: Draft): string => {
    if (!d.name.trim()) return 'Escribe el nombre de la sucursal.';
    if (d.mapsUrl.trim() && !/^https?:\/\//i.test(d.mapsUrl.trim())) {
      return 'El enlace del mapa debe empezar con http:// o https://.';
    }
    if (d.ownHours) {
      if (d.workEndTime <= d.workStartTime) return 'La hora de cierre debe ser después de la de apertura.';
      if (Boolean(d.breakStartTime) !== Boolean(d.breakEndTime)) {
        return 'Elige el inicio y el fin del descanso, o deja los dos en «Sin descanso».';
      }
      if (d.breakStartTime && d.breakEndTime <= d.breakStartTime) {
        return 'El fin del descanso debe ser después de su inicio.';
      }
    }
    return '';
  };

  const handleSave = async () => {
    if (!draft) return;
    const problem = validate(draft);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await saveLocation(businessId, { ...toBody(draft), id: draft.id });
      setDraft(null);
      await onChanged();
      onSuccess('Sucursal guardada correctamente.');
    } catch (e) {
      onError(e, 'No se pudo guardar la sucursal. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // Las sucursales no se borran (las citas ya hechas dependen de ellas): se ocultan y dejan de aparecer al reservar
  const toggleActive = async (l: BusinessLocation) => {
    try {
      await saveLocation(businessId, { ...l, active: !l.active });
      await onChanged();
      onSuccess(l.active ? 'La sucursal ya no aparece al reservar.' : 'La sucursal ya aparece al reservar.');
    } catch (e) {
      onError(e, 'No se pudo cambiar la sucursal. Intenta de nuevo.');
    }
  };

  const toggleOffDay = (day: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      offDays: draft.offDays.includes(day) ? draft.offDays.filter(d => d !== day) : [...draft.offDays, day],
    });
  };

  const describe = (l: BusinessLocation): string[] => {
    const bits: string[] = [];
    bits.push(l.capacity === null ? `${settings.capacity} por horario (general)` : `${l.capacity} por horario`);
    if (l.workStartTime !== null && l.workEndTime !== null) {
      bits.push(`${formatTime(l.workStartTime)} a ${formatTime(l.workEndTime)}`);
    }
    if (l.offDays !== null) {
      const names = WEEK_DAYS.filter(d => l.offDays!.includes(d.id)).map(d => d.label.slice(0, 3));
      bits.push(names.length ? `Descansa: ${names.join(', ')}` : 'Sin días de descanso');
    }
    return bits;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 text-sm text-slate-400 leading-relaxed">
        {locations.length === 0 ? (
          <>
            Si tu negocio tiene <strong className="text-slate-200">un solo lugar</strong>, no necesitas agregar nada.
            Si tienes <strong className="text-slate-200">dos o más sucursales</strong>, agrégalas aquí: tus clientes
            elegirán la sucursal antes de reservar y cada una puede tener su dirección, su horario y sus lugares por horario.
          </>
        ) : activeCount > 1 ? (
          <>Tus clientes eligen una de estas sucursales al reservar. Lo que dejes sin llenar en una sucursal usa la configuración general.</>
        ) : (
          <>
            Con una sola sucursal activa, tus clientes reservan sin elegir sucursal. Agrega otra (o muestra una oculta) para
            que puedan escoger.
          </>
        )}
      </div>

      {!draft && (
        <button
          onClick={() => {
            setFormError('');
            setDraft(emptyDraft(settings));
          }}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700"
        >
          <Plus size={18} /> Agregar sucursal
        </button>
      )}

      {draft && (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold text-white">{draft.id ? 'Editar sucursal' : 'Agregar sucursal'}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="loc-name" className="block text-slate-400 text-sm mb-2">Nombre de la sucursal</label>
              <input
                id="loc-name"
                type="text"
                maxLength={80}
                placeholder="Ej. Sucursal Centro"
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="loc-capacity" className="block text-slate-400 text-sm mb-2">Lugares por horario</label>
              <select
                id="loc-capacity"
                value={draft.capacity}
                onChange={e => setDraft({ ...draft, capacity: e.target.value })}
                className={inputClass}
              >
                <option value="">Igual que la configuración general ({settings.capacity})</option>
                {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="loc-address" className="block text-slate-400 text-sm mb-2">Dirección</label>
              <input
                id="loc-address"
                type="text"
                maxLength={200}
                placeholder="Calle, número, colonia"
                value={draft.address}
                onChange={e => setDraft({ ...draft, address: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="loc-maps" className="block text-slate-400 text-sm mb-2">Enlace de Google Maps (opcional)</label>
              <input
                id="loc-maps"
                type="url"
                placeholder="https://maps.app.goo.gl/..."
                value={draft.mapsUrl}
                onChange={e => setDraft({ ...draft, mapsUrl: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          {/* Horario propio */}
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={draft.ownHours}
                onChange={e => setDraft({ ...draft, ownHours: e.target.checked })}
                className="h-5 w-5 accent-amber-500"
              />
              Esta sucursal tiene su propio horario
            </label>
            {draft.ownHours && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <HourSelect id="loc-start" label="Apertura" value={draft.workStartTime} onChange={v => setDraft({ ...draft, workStartTime: v })} />
                <HourSelect id="loc-end" label="Cierre" value={draft.workEndTime} onChange={v => setDraft({ ...draft, workEndTime: v })} />
                <HourSelect id="loc-bstart" label="Inicio del descanso" value={draft.breakStartTime} allowEmpty onChange={v => setDraft({ ...draft, breakStartTime: v })} />
                <HourSelect id="loc-bend" label="Fin del descanso" value={draft.breakEndTime} allowEmpty onChange={v => setDraft({ ...draft, breakEndTime: v })} />
              </div>
            )}
          </div>

          {/* Días de descanso propios */}
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={draft.ownOffDays}
                onChange={e => setDraft({ ...draft, ownOffDays: e.target.checked })}
                className="h-5 w-5 accent-amber-500"
              />
              Esta sucursal tiene sus propios días de descanso
            </label>
            {draft.ownOffDays && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {WEEK_DAYS.map(day => (
                  <label
                    key={day.id}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                      draft.offDays.includes(day.id)
                        ? 'bg-red-500/10 border-red-500 text-red-400'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={draft.offDays.includes(day.id)}
                      onChange={() => toggleOffDay(day.id)}
                      className="h-4 w-4 accent-red-500"
                    />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {formError && (
            <p className="text-red-500 text-sm bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20">{formError}</p>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={() => setDraft(null)} className="px-4 py-2 text-slate-400 hover:bg-slate-800 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              <Save size={18} /> Guardar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {locations.map(l => (
          <div
            key={l.id}
            className={`bg-slate-900 p-5 rounded-xl border shadow-sm space-y-3 ${
              l.active ? 'border-slate-800' : 'border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-bold text-white text-lg flex items-center gap-2">
                  <MapPin size={18} className="text-amber-500 shrink-0" aria-hidden="true" />
                  <span className="truncate">{l.name}</span>
                </h4>
                {l.address && <p className="text-sm text-slate-400 mt-1">{l.address}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => {
                    setFormError('');
                    setDraft(draftFrom(l, settings));
                  }}
                  aria-label={`Editar ${l.name}`}
                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => toggleActive(l)}
                  aria-label={l.active ? `Ocultar ${l.name}` : `Mostrar ${l.name}`}
                  title={l.active ? 'Ocultar al reservar' : 'Mostrar al reservar'}
                  className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-full transition-colors"
                >
                  {l.active ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <ul className="flex flex-wrap gap-2 text-xs text-slate-300">
              {describe(l).map(bit => (
                <li key={bit} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 flex items-center gap-1">
                  {bit.includes('por horario') ? <Users size={12} aria-hidden="true" /> : <Clock size={12} aria-hidden="true" />}
                  {bit}
                </li>
              ))}
              {!l.active && <li className="bg-slate-800 border border-slate-700 rounded px-2 py-1">Oculto</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminLocations;
