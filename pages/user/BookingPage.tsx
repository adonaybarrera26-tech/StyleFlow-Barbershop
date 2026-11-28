import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Service, Booking, BusinessLocation, BusinessSettings } from '../../types';
import { getServices, createBooking, getTakenSlots, getBusinessSettings } from '../../services/dataService';
import { useBusiness } from '../../services/BusinessContext';
import { getCategory } from '../../services/categories';
import { DEFAULT_SETTINGS, DEFAULT_WAIVER_TEXT } from '../../constants';
import { formatMXN, formatDateLong, formatDateShort, formatTime, isValidMexicanPhone } from '../../services/format';
import { effectiveSchedule, generateTimeSlots, freeSpots, toMinutes } from '../../services/slots';
import { Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight, User, Ban, Loader2, MapPin } from 'lucide-react';

const BookingPage: React.FC = () => {
  const navigate = useNavigate();
  const { business, path, locations } = useBusiness();
  // Con varios locales el primer paso es elegir uno; con uno solo se usa ese sin preguntar
  const needsLocation = locations.length > 1;
  const stepShift = needsLocation ? 1 : 0;
  const [step, setStep] = useState(needsLocation ? 0 : 1);
  const [selectedLocation, setSelectedLocation] = useState<BusinessLocation | null>(locations.length === 1 ? locations[0] : null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Horarios disponibles y configuración
  const [availableSlots, setAvailableSlots] = useState<{ time: string; free: number }[]>([]);
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
          const [fetchedServices, fetchedBookings, fetchedSettings] = await Promise.all([
              getServices(business.id),
              getTakenSlots(business.id),
              getBusinessSettings(business.id)
          ]);
          setServices(fetchedServices);
          setAllBookings(fetchedBookings);
          setSettings(fetchedSettings);
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

  // Horario, descanso y lugares por horario del local elegido (o del negocio, si no tiene locales)
  const schedule = effectiveSchedule(selectedLocation, settings);

  // Servicios que se ofrecen en el local elegido (los que no tienen local se ofrecen en todos)
  const visibleServices = services.filter(s => !s.locationId || s.locationId === selectedLocation?.id);

  // Actualiza los horarios disponibles cuando cambia la fecha, el local o las citas
  useEffect(() => {
    if (loadingData) return;

    const dateString = selectedDate.toDateString();
    const dayOfWeek = selectedDate.getDay(); // 0 (domingo) a 6 (sábado)

    // ¿Es día de descanso?
    if (schedule.offDays.includes(dayOfWeek)) {
        setIsDayOff(true);
        setAvailableSlots([]);
        setSelectedTime('');
        return;
    } else {
        setIsDayOff(false);
    }

    // Citas del día seleccionado en este local
    const dayBookings = allBookings.filter(b =>
        new Date(b.date).toDateString() === dateString && (b.locationId ?? null) === (selectedLocation?.id ?? null)
    );

    // La duración de lo que el cliente eligió también cuenta: un servicio de 2 horas
    // no debe caber en un hueco de 30 minutos.
    const neededMinutes = Math.max(
        selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0),
        schedule.slotInterval
    );

    // Un horario sigue disponible mientras queden lugares: en cada momento de la cita
    // puede haber hasta "capacity" citas a la vez (con capacity 1 es una cita a la vez).
    let free = generateTimeSlots(schedule)
        .map(time => ({
            time,
            free: freeSpots(toMinutes(time), neededMinutes, schedule.capacity, dayBookings, schedule.slotInterval)
        }))
        .filter(slot => slot.free > 0);

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
  }, [selectedDate, allBookings, selectedTime, settings, loadingData, selectedServices, selectedLocation]);

  // Elegir (o cambiar) el local: los servicios que no se ofrecen ahí se quitan y la hora se vuelve a elegir
  const chooseLocation = (location: BusinessLocation) => {
    setSelectedLocation(location);
    setSelectedServices(prev => prev.filter(s => !s.locationId || s.locationId === location.id));
    setSelectedTime('');
    setFormError('');
    setStep(1);
  };

  // Local elegido, para recordarlo en los pasos siguientes (solo cuando hay varios)
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
        await createBooking(business.id, {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          selectedServices,
          totalPrice,
          totalDuration,
          date: selectedDate.toISOString(),
          timeSlot: selectedTime,
          locationId: selectedLocation?.id ?? null
        }, waiverAccepted);

        // Ir a la página de confirmación
        navigate(path('/success'), {
            state: {
                customerName: customerName.trim(),
                formattedDate: formatDateLong(selectedDate),
                timeSlot: selectedTime,
                servicesText: selectedServices.map(s => s.title).join(', '),
                totalPrice,
                locationName: selectedLocation?.name,
                locationAddress: selectedLocation?.address,
                locationMapsUrl: selectedLocation?.mapsUrl
            }
        });

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
          setStep(2);
          setFormError('Ese horario ya se ocupó. Elige otro, por favor.');
        } else if (code === 'waiver_required') {
          setFormError('Para reservar necesitas aceptar el deslinde.');
        } else if (code === 'location_required' || code === 'invalid_location') {
          setStep(needsLocation ? 0 : 1);
          setFormError('Elige un local para continuar.');
        } else if (code === 'invalid_services') {
          try {
            setServices(await getServices(business.id));
          } catch (refreshError) {
            console.error('No se pudieron actualizar los servicios', refreshError);
          }
          setSelectedServices([]);
          setStep(1);
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

  // --- Paso 0 (solo si hay varios locales): elegir local ---
  if (step === 0) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Elige tu local</h2>
          <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-sm font-medium border border-amber-500/20">Paso 1 de {3 + stepShift}</span>
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

  // --- Paso 1: elegir servicios ---
  if (step === 1) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 pb-40 md:pb-0">
        {needsLocation && (
          <button onClick={() => setStep(0)} className="text-slate-400 flex items-center gap-1 hover:text-white transition-colors">
            <ChevronLeft size={16} /> Cambiar de local
          </button>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Elige tus servicios</h2>
            <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-sm font-medium border border-amber-500/20">Paso {1 + stepShift} de {3 + stepShift}</span>
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
                    onClick={() => setStep(2)}
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

  // --- Paso 2: fecha y hora ---
  if (step === 2) {
      const dates = Array.from({length: 14}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          return d;
      });

      return (
        <div className="space-y-8 pb-40 md:pb-24 animate-in slide-in-from-right-4">
            <button onClick={() => setStep(1)} className="text-slate-400 flex items-center gap-1 hover:text-white transition-colors">
                <ChevronLeft size={16} /> Atrás
            </button>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Elige fecha y hora</h2>
                    <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-sm font-medium border border-amber-500/20">Paso {2 + stepShift} de {3 + stepShift}</span>
                </div>
                {locationBadge}
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
                        <span className="font-bold text-lg">El negocio está cerrado este día.</span>
                        <span className="text-sm text-red-300">Elige otro día, por favor.</span>
                    </div>
                ) : availableSlots.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 bg-slate-900/50">
                        No hay horarios disponibles para esta fecha (o ya se ocuparon todos). Elige otro día, por favor.
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {availableSlots.map(({ time, free }) => (
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
                                {schedule.capacity > 1 && (
                                    <span className="block text-[11px] font-normal opacity-70">{free === 1 ? '1 lugar' : `${free} lugares`}</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* En el celular se coloca a 70px del fondo para quedar arriba de la barra de navegación */}
            <div className="fixed bottom-[70px] md:bottom-0 left-0 right-0 p-4 bg-slate-950 border-t border-slate-800 md:static md:bg-transparent md:border-0 z-40">
                <div className="max-w-4xl mx-auto flex justify-end">
                    <button
                        disabled={!selectedTime}
                        onClick={() => setStep(3)}
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

  // --- Paso 3: datos y confirmación ---
  return (
    <div className="space-y-6 pb-24 animate-in slide-in-from-right-4">
        <button onClick={() => { setFormError(''); setStep(2); }} className="text-slate-400 flex items-center gap-1 hover:text-white transition-colors">
            <ChevronLeft size={16} /> Atrás
        </button>

        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Tus datos</h2>
            <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-sm font-medium border border-amber-500/20">Paso {3 + stepShift} de {3 + stepShift}</span>
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

        {settings.waiverEnabled && (
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
        )}

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4">
             <h3 className="font-bold text-white mb-2">Resumen de tu cita</h3>
             {selectedLocation && (
                 <div className="flex justify-between text-sm gap-4">
                     <span className="text-slate-400">Local:</span>
                     <span className="font-medium text-slate-200 text-right">{selectedLocation.name}</span>
                 </div>
             )}
             <div className="flex justify-between text-sm gap-4">
                 <span className="text-slate-400">Servicios:</span>
                 <span className="font-medium text-slate-200 text-right">{selectedServices.map(s => s.title).join(', ')}</span>
             </div>
             <div className="flex justify-between text-sm">
                 <span className="text-slate-400">Fecha:</span>
                 <span className="font-medium text-slate-200">{formatDateShort(selectedDate)}</span>
             </div>
             <div className="flex justify-between text-sm">
                 <span className="text-slate-400">Hora:</span>
                 <span className="font-medium text-slate-200">{formatTime(selectedTime)}</span>
             </div>
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
