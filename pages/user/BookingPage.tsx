import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Service, Booking, BusinessLocation, BusinessSettings, MyBooking, Professional, RescheduleState, TicketState } from '../../types';
import { getServices, createBooking, rescheduleMyBooking, getTakenSlots, getBusinessSettings, getProfessionals } from '../../services/dataService';
import { useBusiness } from '../../services/BusinessContext';
import { getCategory } from '../../services/categories';
import { DEFAULT_SETTINGS, DEFAULT_WAIVER_TEXT } from '../../constants';
import { formatMXN, formatDateShort, formatTime, isValidMexicanPhone, dateToNoonIso } from '../../services/format';
import { ticketDateText } from '../../services/ticket';
import { effectiveSchedule, generateTimeSlots, freeSpots, toMinutes } from '../../services/slots';
import ProAvatar from '../../components/ProAvatar';
import { Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight, User, Users, Ban, Loader2, MapPin, RefreshCw } from 'lucide-react';

// Pasos de la reserva: sucursal (solo si hay varias) -> servicios -> profesional (solo si el negocio tiene) -> fecha y hora -> datos
type Step = 'location' | 'services' | 'pro' | 'time' | 'details';

// Una fila del resumen de la cita; si se puede cambiar, lleva su botón "Cambiar"
const SummaryRow: React.FC<{ label: string; value: string; onChange?: () => void }> = ({ label, value, onChange }) => (
  <div className="flex justify-between text-sm gap-4">
    <span className="text-slate-400 shrink-0">
      {label}:
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          aria-label={`Cambiar ${label.toLowerCase()}`}
          className="ml-2 text-xs font-semibold text-amber-500 underline underline-offset-2 hover:text-amber-400"
        >
          Cambiar
        </button>
      )}
    </span>
    <span className="font-medium text-slate-200 text-right">{value}</span>
  </div>
);

const BookingPage: React.FC = () => {
  const navigate = useNavigate();
  const routeState = useLocation().state as { reschedule?: RescheduleState; prefill?: { customerName?: string; phone?: string } } | null;
  // Si llega una cita para reagendar, solo se elige otro día y otra hora (mismos servicios y sucursal)
  const reschedule = routeState?.reschedule ?? null;
  const { business, path, locations } = useBusiness();
  // Con varias sucursales el primer paso es elegir una; con una sola se usa esa sin preguntar
  const needsLocation = locations.length > 1;
  const [step, setStep] = useState<Step>(reschedule ? 'time' : needsLocation ? 'location' : 'services');
  const [selectedLocation, setSelectedLocation] = useState<BusinessLocation | null>(
    reschedule && reschedule.ticket.locationId
      ? locations.find(l => l.id === reschedule.ticket.locationId) ?? null
      : locations.length === 1 ? locations[0] : null
  );
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  // Con quién: el id del profesional, o 'any' si le da igual (se asigna al primero que tenga lugar)
  const [proChoice, setProChoice] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>(reschedule ? reschedule.ticket.services : []);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [customerName, setCustomerName] = useState(reschedule?.customerName ?? routeState?.prefill?.customerName ?? '');
  const [customerPhone, setCustomerPhone] = useState(reschedule?.phone ?? routeState?.prefill?.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Horarios disponibles y configuración
  const [availableSlots, setAvailableSlots] = useState<{ time: string; free: number; pro: Professional | null }[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isDayOff, setIsDayOff] = useState(false);

  const initData = async () => {
      setLoadingData(true);
      setLoadError(false);
      try {
          // Solo se piden los horarios ocupados (sin nombres ni celulares de otros clientes)
          const [fetchedServices, fetchedBookings, fetchedSettings, fetchedPros] = await Promise.all([
              getServices(business.id),
              getTakenSlots(business.id),
              getBusinessSettings(business.id),
              getProfessionals(business.id)
          ]);
          setServices(fetchedServices);
          setAllBookings(fetchedBookings);
          setSettings(fetchedSettings);
          setProfessionals(fetchedPros);
      } catch (error) {
          console.error("Error al cargar los datos iniciales", error);
          setLoadError(true);
      } finally {
          setLoadingData(false);
      }
  };

  useEffect(() => {
    initData();
  }, []);

  // Profesionales que atienden en la sucursal elegida (los que no tienen sucursal atienden en todas)
  const visiblePros = professionals.filter(p => p.active && (!p.locationId || p.locationId === selectedLocation?.id));
  const hasPros = visiblePros.length > 0;

  // Al reagendar el profesional es el de la cita; si ya no atiende, no se puede reagendar
  const reschedulePro = reschedule?.ticket.professionalId
    ? professionals.find(p => p.id === reschedule.ticket.professionalId && p.active) ?? null
    : null;
  const selectedPro: Professional | null = reschedule
    ? reschedulePro
    : proChoice && proChoice !== 'any' ? visiblePros.find(p => p.id === proChoice) ?? null : null;
  const anyPro = !reschedule && proChoice === 'any';

  // Pasos que se van a recorrer, para decir "Paso 2 de 4" y saber cuál sigue y cuál es el anterior
  const flow: Step[] = [...(needsLocation ? ['location' as Step] : []), 'services', ...(hasPros ? ['pro' as Step] : []), 'time', 'details'];
  const stepLabel = (s: Step) => `Paso ${flow.indexOf(s) + 1} de ${flow.length}`;
  const goNext = (from: Step) => setStep(flow[flow.indexOf(from) + 1] ?? 'details');
  const goBack = (from: Step) => setStep(flow[Math.max(flow.indexOf(from) - 1, 0)]);

  // Horario, descanso y lugares por horario del profesional elegido, de la sucursal o del negocio
  const schedule = effectiveSchedule(selectedLocation, settings, selectedPro);

  // Servicios que se ofrecen en la sucursal elegida (los que no tienen sucursal se ofrecen en todas)
  const visibleServices = services.filter(s => !s.locationId || s.locationId === selectedLocation?.id);

  // Actualiza los horarios disponibles cuando cambia la fecha, la sucursal, el profesional o las citas
  useEffect(() => {
    if (loadingData) return;

    const dateString = selectedDate.toDateString();
    const dayOfWeek = selectedDate.getDay(); // 0 (domingo) a 6 (sábado)

    // Con profesionales se revisa la agenda de cada uno ("cualquiera" junta las de todos); sin ellos, la de la sucursal
    const candidates: (Professional | null)[] = hasPros ? (selectedPro ? [selectedPro] : visiblePros) : [null];

    // La duración de lo que el cliente eligió también cuenta: un servicio de 2 horas
    // no debe caber en un hueco de 30 minutos.
    const neededMinutes = Math.max(
        selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0),
        schedule.slotInterval
    );

    // Al reagendar, la cita actual se va a quitar: su horario no debe contar como ocupado
    const isOwnDay = !!reschedule && new Date(reschedule.ticket.date).toDateString() === dateString;

    // Horarios libres de un día para un profesional (null = día de descanso)
    const slotsFor = (pro: Professional | null) => {
        const sch = effectiveSchedule(selectedLocation, settings, pro);
        if (sch.offDays.includes(dayOfWeek)) return null;

        // Citas del día: las del profesional o, si no hay profesionales, las de la sucursal
        let dayBookings = allBookings.filter(b =>
            new Date(b.date).toDateString() === dateString &&
            (pro ? b.professionalId === pro.id : (b.locationId ?? null) === (selectedLocation?.id ?? null))
        );
        if (isOwnDay && reschedule) {
            const own = dayBookings.findIndex(b => b.timeSlot === reschedule.ticket.timeSlot);
            if (own >= 0) dayBookings = dayBookings.filter((_, i) => i !== own);
        }

        // Un horario sigue disponible mientras queden lugares: en cada momento de la cita
        // puede haber hasta "capacity" citas a la vez (con un profesional es una a la vez).
        return generateTimeSlots(sch)
            .map(time => ({
                time,
                free: freeSpots(toMinutes(time), neededMinutes, sch.capacity, dayBookings, sch.slotInterval),
                pro
            }))
            .filter(slot => slot.free > 0);
    };

    const perCandidate = candidates.map(slotsFor);

    // ¿Es día de descanso? (con "cualquiera", solo si nadie atiende ese día)
    if (perCandidate.every(r => r === null)) {
        setIsDayOff(true);
        setAvailableSlots([]);
        setSelectedTime('');
        return;
    }
    setIsDayOff(false);

    // Cada horario aparece una vez; si varios profesionales lo tienen libre, se asigna el primero
    const merged = new Map<string, { time: string; free: number; pro: Professional | null }>();
    for (const result of perCandidate) {
        for (const slot of result ?? []) {
            if (!merged.has(slot.time)) merged.set(slot.time, slot);
        }
    }
    let free = Array.from(merged.values()).sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

    // Al reagendar no tiene caso ofrecer el mismo horario que ya tiene
    if (isOwnDay && reschedule) free = free.filter(slot => slot.time !== reschedule.ticket.timeSlot);

    // Si la fecha es hoy, quitar los horarios que ya pasaron
    const now = new Date();
    if (selectedDate.toDateString() === now.toDateString()) {
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        free = free.filter(slot => {
            const [h, m] = slot.time.split(':').map(Number);
            if (h < currentHour) return false;
            if (h === currentHour && m <= currentMinute) return false;
            return true;
        });
    }

    setAvailableSlots(free);

    // Limpiar la hora elegida si ya no está disponible
    if (selectedTime && !free.some(slot => slot.time === selectedTime)) {
        setSelectedTime('');
    }
  }, [selectedDate, allBookings, selectedTime, settings, loadingData, selectedServices, selectedLocation, professionals, proChoice]);

  // Desde el resumen: volver a un paso para cambiar algo (lo demás se conserva)
  const changeStep = (target: Step) => {
    setFormError('');
    setStep(target);
  };

  // Con quién quedó la cita: el profesional elegido o, con "cualquiera", el que tiene lugar a esa hora
  const assignedPro: Professional | null = selectedPro ?? availableSlots.find(slot => slot.time === selectedTime)?.pro ?? null;

  // Elegir (o cambiar) la sucursal: los servicios que no se ofrecen ahí se quitan y la hora se vuelve a elegir
  const chooseLocation = (location: BusinessLocation) => {
    setSelectedLocation(location);
    setSelectedServices(prev => prev.filter(s => !s.locationId || s.locationId === location.id));
    setSelectedTime('');
    setProChoice(null);
    setFormError('');
    setStep('services');
  };

  // Elegir (o cambiar) con quién: la hora se vuelve a elegir porque cada profesional tiene su agenda
  const choosePro = (choice: string) => {
    setProChoice(choice);
    setSelectedTime('');
    setFormError('');
    setStep('time');
  };

  // Sucursal elegida, para recordarlo en los pasos siguientes (solo cuando hay varias)
  const locationBadge = needsLocation && selectedLocation ? (
    <p className="flex items-center gap-1.5 text-sm text-slate-400">
      <MapPin size={14} className="text-amber-500" aria-hidden="true" /> {selectedLocation.name}
    </p>
  ) : null;

  const waiverText = settings.waiverText.trim() || DEFAULT_WAIVER_TEXT;


  const toggleService = (service: Service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  const handleBooking = async () => {
      if (!customerName.trim() || !customerPhone.trim()) {
        setFormError('Escribe tu nombre y tu número de celular.');
        return;
      }
      if (!isValidMexicanPhone(customerPhone)) {
        setFormError('Escribe un número de celular válido de 10 dígitos.');
        return;
      }
      if (settings.waiverEnabled && !waiverAccepted) {
        setFormError('Para reservar necesitas aceptar el deslinde.');
        return;
      }
      setFormError('');
      setLoading(true);
      try {
        const created = await createBooking(business.id, {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          selectedServices,
          totalPrice,
          totalDuration,
          date: selectedDate.toISOString(),
          timeSlot: selectedTime,
          locationId: selectedLocation?.id ?? null,
          professionalId: assignedPro?.id ?? null
        }, waiverAccepted);

        // Ir al ticket de la cita
        const ticket: MyBooking = {
            id: created.id,
            date: dateToNoonIso(selectedDate),
            timeSlot: selectedTime,
            services: selectedServices,
            totalPrice,
            totalDuration,
            locationId: selectedLocation?.id ?? null,
            locationName: selectedLocation?.name,
            locationAddress: selectedLocation?.address,
            locationMapsUrl: selectedLocation?.mapsUrl,
            folio: created.folio,
            waiverAccepted,
            professionalId: assignedPro?.id ?? null,
            professionalName: assignedPro?.name
        };
        const ticketState: TicketState = { ticket, phone: customerPhone.trim(), customerName: customerName.trim() };
        navigate(path('/success'), { state: ticketState });

      } catch (e) {
        const code = e instanceof Error ? e.message : '';
        if (code === 'slot_taken' || code === 'past_date' || code === 'day_off' || code === 'invalid_time') {
          // Alguien más tomó ese horario (o ya no está disponible): se actualiza la lista y se vuelve a elegir
          try {
            setAllBookings(await getTakenSlots(business.id));
          } catch (refreshError) {
            console.error('No se pudieron actualizar los horarios', refreshError);
          }
          setSelectedTime('');
          setStep('time');
          setFormError('Ese horario ya se ocupó. Elige otro, por favor.');
        } else if (code === 'waiver_required') {
          setFormError('Para reservar necesitas aceptar el deslinde.');
        } else if (code === 'professional_required' || code === 'invalid_professional') {
          // El profesional ya no atiende (o el negocio agregó profesionales): se actualiza la lista y se vuelve a elegir
          try {
            setProfessionals(await getProfessionals(business.id));
          } catch (refreshError) {
            console.error('No se pudieron actualizar los profesionales', refreshError);
          }
          setProChoice(null);
          setSelectedTime('');
          setStep('pro');
          setFormError('Elige con quién quieres tu cita.');
        } else if (code === 'location_required' || code === 'invalid_location') {
          setStep(needsLocation ? 'location' : 'services');
          setFormError('Elige una sucursal para continuar.');
        } else if (code === 'invalid_services') {
          try {
            setServices(await getServices(business.id));
          } catch (refreshError) {
            console.error('No se pudieron actualizar los servicios', refreshError);
          }
          setSelectedServices([]);
          setStep('services');
          setFormError('Alguno de los servicios ya no está disponible. Elígelos de nuevo, por favor.');
        } else if (code === 'invalid_phone') {
          setFormError('Escribe un número de celular válido de 10 dígitos.');
        } else if (code === 'invalid_name') {
          setFormError('Escribe tu nombre.');
        } else if (code === 'too_many_bookings') {
          const max = settings.maxBookingsPerPhone;
          setFormError(
            `Ya tienes ${max === 1 ? '1 cita próxima' : `${max} citas próximas`} con este número, que es el máximo. ` +
            'Cancela una en "Mis reservas" o espera a que pase.'
          );
        } else {
          setFormError('No pudimos guardar tu cita. Revisa tu internet e intenta de nuevo.');
        }
      } finally {
        setLoading(false);
      }
    };

  // La persona ya aceptó el deslinde cuando reservó; si el negocio lo activó después, se lo pedimos aquí
  const needsWaiverNow = !!reschedule && settings.waiverEnabled && !reschedule.ticket.waiverAccepted;

  // Deslinde: texto y casilla para aceptarlo (al reservar y, si hace falta, al reagendar)
  const waiverBlock = (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-white">Deslinde de responsabilidad</h3>
            <div className="max-h-44 overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {waiverText}
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={waiverAccepted}
                    onChange={(e) => { setWaiverAccepted(e.target.checked); setFormError(''); }}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-amber-500"
                />
                <span className="text-sm text-slate-200">He leído y acepto el deslinde.</span>
            </label>
    </div>
  );

  const handleReschedule = async () => {
      if (!reschedule) return;
      if (needsWaiverNow && !waiverAccepted) {
        setFormError('Para reagendar necesitas aceptar el deslinde.');
        return;
      }
      setFormError('');
      setLoading(true);
      try {
        const newId = await rescheduleMyBooking(
          business.id, reschedule.ticket.id, reschedule.phone, selectedDate, selectedTime, waiverAccepted
        );
        const ticketState: TicketState = {
          ticket: {
            ...reschedule.ticket,
            id: newId,
            date: dateToNoonIso(selectedDate),
            timeSlot: selectedTime,
            waiverAccepted: reschedule.ticket.waiverAccepted || waiverAccepted
          },
          phone: reschedule.phone,
          customerName: reschedule.customerName,
          rescheduled: true,
          previous: { date: reschedule.ticket.date, timeSlot: reschedule.ticket.timeSlot }
        };
        navigate(path('/success'), { state: ticketState, replace: true });
      } catch (e) {
        const code = e instanceof Error ? e.message : '';
        if (code === 'slot_taken' || code === 'past_date' || code === 'day_off' || code === 'invalid_time') {
          try {
            setAllBookings(await getTakenSlots(business.id));
          } catch (refreshError) {
            console.error('No se pudieron actualizar los horarios', refreshError);
          }
          setSelectedTime('');
          setFormError('Ese horario ya se ocupó. Elige otro, por favor.');
        } else if (code === 'same_slot') {
          setFormError('Elige un horario distinto al de tu cita actual.');
        } else if (code === 'booking_not_found') {
          setFormError('No encontramos tu cita. Puede que ya se haya cancelado o que ya haya pasado.');
        } else if (code === 'waiver_required') {
          setFormError('Para reagendar necesitas aceptar el deslinde.');
        } else {
          setFormError('No pudimos reagendar tu cita. Revisa tu internet e intenta de nuevo.');
        }
      } finally {
        setLoading(false);
      }
  };

  if (loadError) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 px-6">
              <p className="text-slate-300">No pudimos cargar la información. Revisa tu internet e intenta de nuevo.</p>
              <button
                  onClick={initData}
                  className="sticker bg-amber-500 text-black px-8 py-3 rounded-xl font-extrabold hover:bg-amber-400"
              >
                  Reintentar
              </button>
          </div>
      );
  }

  if (loadingData) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
              <p>Cargando información...</p>
          </div>
      );
  }

  // Al reagendar, si la sucursal de la cita ya no se ofrece no se puede calcular su horario
  if (reschedule && reschedule.ticket.locationId && !selectedLocation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 px-6">
        <p className="text-slate-300">La sucursal de tu cita ya no está disponible. Cancela esta cita y reserva de nuevo, por favor.</p>
        <button
          onClick={() => navigate(-1)}
          className="sticker bg-amber-500 text-black px-8 py-3 rounded-xl font-extrabold hover:bg-amber-400"
        >
          Volver
        </button>
      </div>
    );
  }

  // Al reagendar, si el profesional de la cita ya no atiende (o la cita es anterior a los profesionales) no se puede calcular su agenda
  if (reschedule && ((reschedule.ticket.professionalId && !reschedulePro) || (!reschedule.ticket.professionalId && hasPros))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 px-6">
        <p className="text-slate-300">
          {reschedule.ticket.professionalName
            ? `${reschedule.ticket.professionalName} ya no atiende en este horario.`
            : 'Esta cita se hizo antes de que se pudiera elegir con quién.'}{' '}
          Cancela esta cita y reserva de nuevo, por favor.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="sticker bg-amber-500 text-black px-8 py-3 rounded-xl font-extrabold hover:bg-amber-400"
        >
          Volver
        </button>
      </div>
    );
  }

  // --- Paso (solo si hay varias sucursales): elegir sucursal ---
  if (step === 'location') {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Elige tu sucursal</h2>
          <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-sm font-medium border border-amber-500/20">{stepLabel('location')}</span>
        </div>

        {formError && (
          <p className="text-red-500 text-sm text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">{formError}</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {locations.map(location => {
            const isSelected = selectedLocation?.id === location.id;
            return (
              <button
                key={location.id}
                onClick={() => chooseLocation(location)}
                className={`text-left p-5 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 pop-accent'
                    : 'border-slate-800 hover:border-amber-500/60 bg-slate-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <MapPin className="text-amber-500 mt-1 shrink-0" size={22} aria-hidden="true" />
                  <div>
                    <h3 className="font-display uppercase tracking-wide text-2xl text-white">{location.name}</h3>
                    {location.address && <p className="text-sm text-slate-400 mt-2 leading-relaxed">{location.address}</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // --- Paso: elegir servicios ---
  if (step === 'services') {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 pb-40 md:pb-0">
        {needsLocation && (
          <button onClick={() => setStep('location')} className="text-slate-400 flex items-center gap-1 hover:text-white transition-colors">
            <ChevronLeft size={16} /> Cambiar de sucursal
          </button>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Elige tus servicios</h2>
            <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-sm font-medium border border-amber-500/20">{stepLabel('services')}</span>
          </div>
          {locationBadge}
        </div>

        {formError && (
          <p className="text-red-500 text-sm text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">{formError}</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {visibleServices.map(service => {
            const isSelected = selectedServices.find(s => s.id === service.id);
            return (
              <div
                key={service.id}
                onClick={() => toggleService(service)}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 pop-accent'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900'
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-display uppercase tracking-wide text-2xl text-white">{service.title}</h3>
                    <p className="text-sm text-slate-400 mt-2 leading-relaxed">{service.description}</p>
                    <div className="flex items-center gap-4 mt-4 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"><Clock size={14} /> {service.durationMinutes} min</span>
                    </div>
                  </div>
                  <div className="font-display text-amber-500 text-3xl leading-none whitespace-nowrap">
                    {formatMXN(service.price)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* En el celular se coloca a 70px del fondo para quedar arriba de la barra de navegación */}
        <div className="fixed bottom-[70px] md:bottom-0 left-0 right-0 p-4 bg-slate-950 border-t border-slate-800 md:static md:bg-transparent md:border-0 z-40">
            <div className="max-w-4xl mx-auto flex justify-between items-center bg-slate-900 md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none shadow-xl md:shadow-none border md:border-0 border-slate-800">
                <div className="text-white">
                    <span className="block text-xs text-slate-400">Total</span>
                    <span className="font-bold text-2xl text-amber-500">{formatMXN(totalPrice)} <span className="text-sm text-slate-400">MXN</span></span>
                </div>
                <button
                    disabled={selectedServices.length === 0}
                    onClick={() => {
                        setFormError('');
                        // Si ya eligió con quién (y volvió a cambiar servicios), no se le pregunta otra vez
                        setStep(hasPros && (selectedPro || anyPro) ? 'time' : flow[flow.indexOf('services') + 1]);
                    }}
                    className="sticker bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-black px-8 py-3 rounded-xl font-extrabold hover:bg-amber-400 flex items-center gap-2"
                >
                    Continuar
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
      </div>
    );
  }

  // --- Paso (solo si el negocio tiene profesionales): elegir con quién ---
  if (step === 'pro') {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 pb-24">
        <button onClick={() => { setFormError(''); goBack('pro'); }} className="text-slate-400 flex items-center gap-1 hover:text-white transition-colors">
          <ChevronLeft size={16} /> Atrás
        </button>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Elige con quién</h2>
            <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-sm font-medium border border-amber-500/20">{stepLabel('pro')}</span>
          </div>
          {locationBadge}
        </div>

        {formError && (
          <p className="text-red-500 text-sm text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">{formError}</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {visiblePros.map(pro => {
            const isSelected = proChoice === pro.id;
            return (
              <button
                key={pro.id}
                onClick={() => choosePro(pro.id)}
                className={`text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 pop-accent'
                    : 'border-slate-800 hover:border-amber-500/60 bg-slate-900'
                }`}
              >
                <ProAvatar name={pro.name} photoUrl={pro.photoUrl} className="w-20 h-20 rounded-2xl" />
                <div className="min-w-0">
                  <h3 className="font-display uppercase tracking-wide text-2xl text-white leading-tight">{pro.name}</h3>
                  {pro.title && <p className="text-sm text-slate-400 mt-1">{pro.title}</p>}
                </div>
              </button>
            );
          })}

          {visiblePros.length > 1 && (
            <button
              onClick={() => choosePro('any')}
              className={`text-left p-4 rounded-2xl border-2 border-dashed transition-all flex items-center gap-4 ${
                proChoice === 'any'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-700 hover:border-amber-500/60 bg-slate-900/50'
              }`}
            >
              <span className="w-20 h-20 rounded-2xl bg-slate-800 text-amber-500 flex items-center justify-center shrink-0">
                <Users size={32} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="font-display uppercase tracking-wide text-2xl text-white leading-tight">Cualquiera disponible</h3>
                <p className="text-sm text-slate-400 mt-1">Más horarios para elegir</p>
              </div>
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- Paso: fecha y hora ---
  if (step === 'time') {
      const dates = Array.from({length: 14}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          return d;
      });

      return (
        <div className="space-y-8 pb-40 md:pb-24 animate-in slide-in-from-right-4">
            <button onClick={() => (reschedule ? navigate(-1) : goBack('time'))} className="text-slate-400 flex items-center gap-1 hover:text-white transition-colors">
                <ChevronLeft size={16} /> {reschedule ? 'Volver a mi ticket' : 'Atrás'}
            </button>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">{reschedule ? 'Reagendar tu cita' : 'Elige fecha y hora'}</h2>
                    {!reschedule && (
                        <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-sm font-medium border border-amber-500/20">{stepLabel('time')}</span>
                    )}
                </div>
                {locationBadge}
                {(selectedPro || anyPro) && (
                    <p className="flex items-center gap-2 text-sm text-slate-400">
                        {selectedPro
                            ? <ProAvatar name={selectedPro.name} photoUrl={selectedPro.photoUrl} className="w-7 h-7 rounded-full" />
                            : <Users size={14} className="text-amber-500" aria-hidden="true" />}
                        {selectedPro ? `Con ${selectedPro.name}` : 'Con cualquiera disponible'}
                    </p>
                )}
                {reschedule && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm space-y-1">
                        <p className="text-slate-500">Tu cita actual</p>
                        <p className="text-slate-200 font-medium">{ticketDateText(reschedule.ticket)}, {formatTime(reschedule.ticket.timeSlot)}</p>
                        <p className="text-slate-400">{reschedule.ticket.services.map(s => s.title).join(', ')}</p>
                        {reschedule.ticket.professionalName && <p className="text-slate-400">Con {reschedule.ticket.professionalName}</p>}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <h3 className="font-semibold text-slate-300 flex items-center gap-2">
                    <CalendarIcon size={18} className="text-amber-500" /> Fecha
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {dates.map((date) => {
                         const dayName = new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(date);
                         const dayNumber = new Intl.DateTimeFormat('es-MX', { day: 'numeric' }).format(date);
                         const monthName = new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(date);

                         const isSelected = date.toDateString() === selectedDate.toDateString();

                         return (
                             <button
                                key={date.toISOString()}
                                onClick={() => { setSelectedDate(date); setFormError(''); }}
                                className={`flex-shrink-0 w-24 h-32 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                                    isSelected
                                    ? 'bg-amber-500 text-black border-amber-500 pop-ink -translate-y-1'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
                                }`}
                             >
                                 <span className="text-xs opacity-80 capitalize">{dayName}</span>
                                 <span className="font-display text-4xl">{dayNumber}</span>
                                 <span className="text-xs font-medium capitalize">{monthName}</span>
                             </button>
                         )
                    })}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-semibold text-slate-300 flex items-center gap-2">
                    <Clock size={18} className="text-amber-500" /> Horarios disponibles
                </h3>

                {formError && (
                    <p className="text-red-500 text-sm text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">{formError}</p>
                )}

                {isDayOff ? (
                    <div className="p-12 text-center border-2 border-dashed border-red-500/30 rounded-2xl text-red-400 bg-red-500/5 flex flex-col items-center gap-3">
                        <Ban size={32} />
                        <span className="font-bold text-lg">{selectedPro ? `${selectedPro.name} no atiende este día.` : 'El negocio está cerrado este día.'}</span>
                        <span className="text-sm text-red-300">Elige otro día, por favor.</span>
                    </div>
                ) : availableSlots.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 bg-slate-900/50">
                        No hay horarios disponibles para esta fecha (o ya se ocuparon todos). Elige otro día, por favor.
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {availableSlots.map(({ time, free, pro }) => (
                            <button
                                key={time}
                                onClick={() => { setSelectedTime(time); setFormError(''); }}
                                className={`py-3 px-2 rounded-xl text-sm font-medium border transition-all ${
                                    selectedTime === time
                                    ? 'bg-white text-slate-900 border-white font-bold shadow-lg'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                                }`}
                            >
                                {formatTime(time)}
                                {!hasPros && schedule.capacity > 1 && (
                                    <span className="block text-[11px] font-normal opacity-70">{free === 1 ? '1 lugar' : `${free} lugares`}</span>
                                )}
                                {anyPro && pro && (
                                    <span className="block text-[11px] font-normal opacity-70 truncate">{pro.name.split(/\s+/)[0]}</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {needsWaiverNow && waiverBlock}

            {/* En el celular se coloca a 70px del fondo para quedar arriba de la barra de navegación */}
            <div className="fixed bottom-[70px] md:bottom-0 left-0 right-0 p-4 bg-slate-950 border-t border-slate-800 md:static md:bg-transparent md:border-0 z-40">
                <div className="max-w-4xl mx-auto flex justify-end">
                    {reschedule ? (
                        <button
                            disabled={!selectedTime || loading}
                            onClick={handleReschedule}
                            className="sticker bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-black px-8 py-3 rounded-xl font-extrabold hover:bg-amber-400 flex items-center gap-2"
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                            {loading ? 'Guardando...' : 'Reagendar cita'}
                        </button>
                    ) : (
                        <button
                            disabled={!selectedTime}
                            onClick={() => { setFormError(''); goNext('time'); }}
                            className="sticker bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-black px-8 py-3 rounded-xl font-extrabold hover:bg-amber-400 flex items-center gap-2"
                        >
                            Continuar
                            <ChevronRight size={20} />
                        </button>
                    )}
                </div>
            </div>
        </div>
      );
  }

  // --- Paso: datos y confirmación ---
  return (
    <div className="space-y-6 pb-24 animate-in slide-in-from-right-4">
        <button onClick={() => { setFormError(''); goBack('details'); }} className="text-slate-400 flex items-center gap-1 hover:text-white transition-colors">
            <ChevronLeft size={16} /> Atrás
        </button>

        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Tus datos</h2>
            <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-sm font-medium border border-amber-500/20">{stepLabel('details')}</span>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Nombre completo</label>
                <div className="relative">
                    <User className="absolute left-3 top-3.5 text-slate-500" size={20} />
                    <input
                        type="text"
                        value={customerName}
                        onChange={(e) => { setCustomerName(e.target.value); setFormError(''); }}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                        placeholder="Ej. Juan Pérez"
                    />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Celular (WhatsApp)</label>
                <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => { setCustomerPhone(e.target.value); setFormError(''); }}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                    placeholder="55 1234 5678"
                />
            </div>
            {getCategory(business.category).health && (
                <p className="text-xs text-slate-400">
                    Solo te pedimos tu nombre y celular. Para reservar no necesitas contarnos nada de tu salud.
                </p>
            )}
        </div>

        {settings.waiverEnabled && waiverBlock}

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4">
             <h3 className="font-bold text-white mb-2">Resumen de tu cita</h3>
             {selectedLocation && (
                 <SummaryRow label="Sucursal" value={selectedLocation.name} onChange={needsLocation ? () => changeStep('location') : undefined} />
             )}
             {assignedPro && (
                 <SummaryRow label="Con" value={assignedPro.name} onChange={hasPros ? () => changeStep('pro') : undefined} />
             )}
             <SummaryRow label="Servicios" value={selectedServices.map(s => s.title).join(', ')} onChange={() => changeStep('services')} />
             <SummaryRow label="Fecha y hora" value={`${formatDateShort(selectedDate)}, ${formatTime(selectedTime)}`} onChange={() => changeStep('time')} />
             <div className="flex justify-between text-sm">
                 <span className="text-slate-400">Duración:</span>
                 <span className="font-medium text-slate-200">{totalDuration} min</span>
             </div>
             <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                 <span className="font-bold text-white">Total a pagar en el local:</span>
                 <span className="font-bold text-xl text-amber-500">{formatMXN(totalPrice)}</span>
             </div>
        </div>

        {formError && (
            <p className="text-red-500 text-sm text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">{formError}</p>
        )}

        <button
            onClick={handleBooking}
            disabled={loading}
            className="sticker w-full bg-amber-500 text-black py-4 rounded-xl font-extrabold text-lg hover:bg-amber-400 flex justify-center items-center gap-2 disabled:opacity-60"
        >
            {loading ? 'Guardando...' : 'Confirmar cita'}
        </button>
    </div>
  );
};

export default BookingPage;
