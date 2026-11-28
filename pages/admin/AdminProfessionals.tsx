import React, { useRef, useState } from 'react';
import { Plus, Edit2, Eye, EyeOff, Clock, Save, MapPin, Camera, Trash2 } from 'lucide-react';
import { BusinessLocation, BusinessSettings, Professional } from '../../types';
import { saveProfessional } from '../../services/dataService';
import { photoToDataUrl } from '../../services/photo';
import { formatTime } from '../../services/format';
import ProAvatar from '../../components/ProAvatar';
import { HourSelect, WEEK_DAYS, inputClass } from './AdminLocations';

// Lo que se edita en el formulario: lo que el profesional deja "igual que la sucursal o el negocio" se guarda como vacío (null)
interface Draft {
  id?: string;
  name: string;
  title: string;
  photoUrl: string;
  locationId: string; // '' = atiende en todas las sucursales
  ownHours: boolean;
  workStartTime: string;
  workEndTime: string;
  breakStartTime: string;
  breakEndTime: string;
  ownOffDays: boolean;
  offDays: number[];
  active: boolean;
}

const emptyDraft = (settings: BusinessSettings): Draft => ({
  name: '',
  title: '',
  photoUrl: '',
  locationId: '',
  ownHours: false,
  workStartTime: settings.workStartTime,
  workEndTime: settings.workEndTime,
  breakStartTime: settings.breakStartTime || '',
  breakEndTime: settings.breakEndTime || '',
  ownOffDays: false,
  offDays: settings.offDays,
  active: true,
});

const draftFrom = (p: Professional, settings: BusinessSettings): Draft => ({
  id: p.id,
  name: p.name,
  title: p.title,
  photoUrl: p.photoUrl,
  locationId: p.locationId ?? '',
  ownHours: p.workStartTime !== null,
  workStartTime: p.workStartTime ?? settings.workStartTime,
  workEndTime: p.workEndTime ?? settings.workEndTime,
  breakStartTime: (p.workStartTime !== null ? p.breakStartTime : settings.breakStartTime) || '',
  breakEndTime: (p.workStartTime !== null ? p.breakEndTime : settings.breakEndTime) || '',
  ownOffDays: p.offDays !== null,
  offDays: p.offDays ?? settings.offDays,
  active: p.active,
});

interface Props {
  businessId: string;
  professionals: Professional[]; // todos, también los ocultos
  locations: BusinessLocation[]; // todas, también las ocultas
  settings: BusinessSettings;
  onChanged: () => Promise<void> | void; // recargar la lista después de guardar
  onSuccess: (message: string) => void;
  onError: (error: unknown, message: string) => void;
}

const AdminProfessionals: React.FC<Props> = ({ businessId, professionals, locations, settings, onChanged, onSuccess, onError }) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const activeCount = professionals.filter(p => p.active).length;

  const toBody = (d: Draft) => ({
    name: d.name.trim(),
    title: d.title.trim(),
    photoUrl: d.photoUrl,
    locationId: d.locationId || null,
    workStartTime: d.ownHours ? d.workStartTime : null,
    workEndTime: d.ownHours ? d.workEndTime : null,
    breakStartTime: d.ownHours && d.breakStartTime && d.breakEndTime ? d.breakStartTime : null,
    breakEndTime: d.ownHours && d.breakStartTime && d.breakEndTime ? d.breakEndTime : null,
    offDays: d.ownOffDays ? d.offDays : null,
    active: d.active,
  });

  const validate = (d: Draft): string => {
    if (!d.name.trim()) return 'Escribe el nombre.';
    if (d.ownHours) {
      if (d.workEndTime <= d.workStartTime) return 'La hora de salida debe ser después de la de entrada.';
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
      const existing = professionals.find(p => p.id === draft.id);
      await saveProfessional(businessId, { ...toBody(draft), id: draft.id, sortOrder: existing?.sortOrder });
      setDraft(null);
      await onChanged();
      onSuccess('Guardado correctamente.');
    } catch (e) {
      onError(e, 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // Los profesionales no se borran (sus citas ya hechas dependen de ellos): se ocultan y dejan de aparecer al reservar
  const toggleActive = async (p: Professional) => {
    try {
      await saveProfessional(businessId, { ...p, active: !p.active });
      await onChanged();
      onSuccess(p.active ? 'Ya no aparece al reservar.' : 'Ya aparece al reservar.');
    } catch (e) {
      onError(e, 'No se pudo hacer el cambio. Intenta de nuevo.');
    }
  };

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !draft) return;
    setPhotoBusy(true);
    try {
      const photoUrl = await photoToDataUrl(file);
      setDraft(current => (current ? { ...current, photoUrl } : current));
      setFormError('');
    } catch (err) {
      setFormError(
        err instanceof Error && err.message === 'image_too_big'
          ? 'La foto pesa demasiado. Prueba con otra.'
          : 'No se pudo leer esa foto. Prueba con una imagen JPG o PNG.'
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const toggleOffDay = (day: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      offDays: draft.offDays.includes(day) ? draft.offDays.filter(d => d !== day) : [...draft.offDays, day],
    });
  };

  const placeOf = (p: Professional): string => {
    if (!p.locationId) return locations.length > 1 ? 'Todas las sucursales' : '';
    return locations.find(l => l.id === p.locationId)?.name || '';
  };

  const describe = (p: Professional): string[] => {
    const bits: string[] = [];
    if (p.workStartTime !== null && p.workEndTime !== null) {
      bits.push(`${formatTime(p.workStartTime)} a ${formatTime(p.workEndTime)}`);
    } else {
      bits.push('Horario del negocio');
    }
    if (p.offDays !== null) {
      const names = WEEK_DAYS.filter(d => p.offDays!.includes(d.id)).map(d => d.label.slice(0, 3));
      bits.push(names.length ? `Descansa: ${names.join(', ')}` : 'Sin días de descanso');
    }
    return bits;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 text-sm text-slate-400 leading-relaxed">
        {professionals.length === 0 ? (
          <>
            Si tu negocio lo atiende <strong className="text-slate-200">una sola persona</strong>, no necesitas agregar nada.
            Si tienes <strong className="text-slate-200">barberos, instructoras o doctores</strong>, agrégalos aquí con su foto:
            tus clientes elegirán con quién reservar y cada uno tiene su propia agenda, así que dos citas con personas
            distintas pueden ser a la misma hora.
          </>
        ) : activeCount > 0 ? (
          <>
            Tus clientes eligen con quién reservar entre quienes están activos. Lo que dejes sin llenar usa el horario de
            la sucursal o del negocio.
          </>
        ) : (
          <>Todos están ocultos: tus clientes reservan sin elegir con quién. Muestra a alguien para que puedan escoger.</>
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
          <Plus size={18} /> Agregar a alguien del equipo
        </button>
      )}

      {draft && (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold text-white">{draft.id ? 'Editar' : 'Agregar a alguien del equipo'}</h3>

          {/* Foto */}
          <div className="flex items-center gap-4">
            <ProAvatar name={draft.name || '?'} photoUrl={draft.photoUrl} className="w-24 h-24 rounded-2xl" />
            <div className="space-y-2">
              <input ref={fileInput} type="file" accept="image/*" onChange={pickPhoto} className="hidden" aria-label="Elegir foto" />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={photoBusy}
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 disabled:opacity-50"
              >
                <Camera size={18} /> {photoBusy ? 'Cargando...' : draft.photoUrl ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {draft.photoUrl && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, photoUrl: '' })}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400"
                >
                  <Trash2 size={14} /> Quitar foto
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pro-name" className="block text-slate-400 text-sm mb-2">Nombre</label>
              <input
                id="pro-name"
                type="text"
                maxLength={80}
                placeholder="Ej. Luis"
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="pro-title" className="block text-slate-400 text-sm mb-2">Puesto o especialidad (opcional)</label>
              <input
                id="pro-title"
                type="text"
                maxLength={60}
                placeholder="Ej. Fade y barba"
                value={draft.title}
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                className={inputClass}
              />
            </div>
            {locations.length > 1 && (
              <div>
                <label htmlFor="pro-location" className="block text-slate-400 text-sm mb-2">Dónde atiende</label>
                <select
                  id="pro-location"
                  value={draft.locationId}
                  onChange={e => setDraft({ ...draft, locationId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Todas las sucursales</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}
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
              Tiene su propio horario
            </label>
            {draft.ownHours && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <HourSelect id="pro-start" label="Entrada" value={draft.workStartTime} onChange={v => setDraft({ ...draft, workStartTime: v })} />
                <HourSelect id="pro-end" label="Salida" value={draft.workEndTime} onChange={v => setDraft({ ...draft, workEndTime: v })} />
                <HourSelect id="pro-bstart" label="Inicio del descanso" value={draft.breakStartTime} allowEmpty onChange={v => setDraft({ ...draft, breakStartTime: v })} />
                <HourSelect id="pro-bend" label="Fin del descanso" value={draft.breakEndTime} allowEmpty onChange={v => setDraft({ ...draft, breakEndTime: v })} />
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
              Tiene sus propios días de descanso
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
              disabled={saving || photoBusy}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              <Save size={18} /> Guardar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {professionals.map(p => (
          <div
            key={p.id}
            className={`bg-slate-900 p-5 rounded-xl border shadow-sm space-y-3 ${
              p.active ? 'border-slate-800' : 'border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <ProAvatar name={p.name} photoUrl={p.photoUrl} className="w-16 h-16 rounded-xl" />
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-lg truncate">{p.name}</h4>
                  {p.title && <p className="text-sm text-slate-400">{p.title}</p>}
                  {placeOf(p) && (
                    <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                      <MapPin size={12} aria-hidden="true" /> {placeOf(p)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => {
                    setFormError('');
                    setDraft(draftFrom(p, settings));
                  }}
                  aria-label={`Editar ${p.name}`}
                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  aria-label={p.active ? `Ocultar a ${p.name}` : `Mostrar a ${p.name}`}
                  title={p.active ? 'Ocultar al reservar' : 'Mostrar al reservar'}
                  className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-full transition-colors"
                >
                  {p.active ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <ul className="flex flex-wrap gap-2 text-xs text-slate-300">
              {describe(p).map(bit => (
                <li key={bit} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 flex items-center gap-1">
                  <Clock size={12} aria-hidden="true" />
                  {bit}
                </li>
              ))}
              {!p.active && <li className="bg-slate-800 border border-slate-700 rounded px-2 py-1">Oculto</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminProfessionals;
