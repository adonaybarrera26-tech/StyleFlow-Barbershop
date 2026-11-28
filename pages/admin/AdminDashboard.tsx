import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Booking, Service, BusinessSettings } from '../../types';
import { getBookings, getServices, saveService, deleteService, deleteBooking, getBusinessSettings, saveBusinessSettings, cleanupOldBookings, isAdminLoggedIn, logoutAdmin } from '../../services/dataService';
import { Download, Plus, Trash2, Edit2, Clock, CalendarCheck, Printer, Filter, Settings, Save, CheckCircle2, XCircle, X, RefreshCw, MessageCircle } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../../constants';
import { useBusiness } from '../../services/BusinessContext';
import { formatMXN, formatTime, formatDateTimeShort, getDateParts, escapeHtml, buildCustomerWhatsAppLink } from '../../services/format';
import AdminSummary from './AdminSummary';

const AdminDashboard: React.FC = () => {
  const { business, path, url: businessUrl } = useBusiness();
  const [activeTab, setActiveTab] = useState<'summary' | 'bookings' | 'services' | 'settings'>('summary');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Aviso emergente
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  // Servicio pendiente de eliminar (ventana de confirmación)
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  // Cita pendiente de cancelar (ventana de confirmación)
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  // Cita recién cancelada (para ofrecer avisarle al cliente por WhatsApp)
  const [cancelledBooking, setCancelledBooking] = useState<Booking | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const checkAccess = async () => {
      const isAuth = await isAdminLoggedIn(business);
      if (cancelled) return;
      if (!isAuth) {
        navigate(path('/admin/login'));
        return;
      }
      loadData();
    };
    checkAccess();
    return () => { cancelled = true; };
  }, [navigate]);

  // Actualización automática cada 5 minutos (300000 ms) si está activada
  useEffect(() => {
      let intervalId: any;
      if (autoRefresh) {
          intervalId = setInterval(() => {
              loadData(true); // true = actualización silenciosa
          }, 300000);
      }
      return () => {
          if (intervalId) clearInterval(intervalId);
      };
  }, [autoRefresh]);

  // Ocultar el aviso después de 3 segundos
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const loadData = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
        // Primero limpiar citas antiguas (ayer y antes)
        await cleanupOldBookings();

        const b = await getBookings(business.id);
        const s = await getServices(business.id);
        const config = await getBusinessSettings(business.id);

        // Ordenar citas: día ascendente y luego hora ascendente
        const sortedBookings = b.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);

            // Normalizar a AAAAMMDD para comparar solo días del calendario
            const dayA = dateA.getFullYear() * 10000 + dateA.getMonth() * 100 + dateA.getDate();
            const dayB = dateB.getFullYear() * 10000 + dateB.getMonth() * 100 + dateB.getDate();

            if (dayA !== dayB) return dayA - dayB; // La fecha más próxima primero
            return a.timeSlot.localeCompare(b.timeSlot); // La hora más temprana primero
        });

        setBookings(sortedBookings);
        setServices(s);
        // La actualización automática no toca la configuración: así no borra lo que se esté editando sin guardar
        if (!silent) setSettings(config);
    } catch (error) {
        console.error("No se pudieron cargar los datos", error);
        handleActionError(error, 'No se pudieron cargar los datos. Revisa tu internet e intenta de nuevo.', silent);
    } finally {
        if (!silent) setIsRefreshing(false);
    }
  };

  // Si la sesión venció, se regresa al acceso; si no, se muestra un aviso
  const handleActionError = (error: unknown, message: string, silent = false) => {
    if (error instanceof Error && error.message === 'session_expired') {
      navigate(path('/admin/login'));
      return;
    }
    if (!silent) setNotification({ type: 'error', message });
  };

  // Fecha en partes: día de la semana y "26 de noviembre de 2026"
  const getFormattedDateParts = (dateStr: string) => getDateParts(new Date(dateStr));

  const exportExcel = async () => {
    // xlsx se carga solo cuando hace falta para no hacer pesada la app
    const XLSX = await import('xlsx');
    const dataToExport = getDisplayedBookings();
    const data = dataToExport.map(b => {
      const { full } = getFormattedDateParts(b.date);
      return {
        'Cliente': b.customerName,
        'Celular': b.customerPhone,
        'Servicios': b.selectedServices.map(s => s.title).join(', '),
        'Fecha': full,
        'Hora': formatTime(b.timeSlot),
        'Total (MXN)': b.totalPrice,
        'Registrada': formatDateTimeShort(new Date(b.createdAt))
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Citas");
    XLSX.writeFile(wb, showTodayOnly ? `${business.slug}_citas_de_hoy.xlsx` : `${business.slug}_todas_las_citas.xlsx`);
  };

  // Función general de impresión (sirve para "Imprimir todas" y "Imprimir día")
  const handlePrint = (bookingsToPrint: Booking[], title: string) => {
      const grouped = groupBookingsByDate(bookingsToPrint);
      // Fechas en orden ascendente
      const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const [yA, mA, dA] = a.split('-').map(Number);
        const [yB, mB, dB] = b.split('-').map(Number);
        const dateA = new Date(yA, mA, dA).getTime();
        const dateB = new Date(yB, mB, dB).getTime();
        return dateA - dateB;
      });

      const printWindow = window.open('', '_blank');
      if (printWindow) {
          printWindow.document.write(`
              <html lang="es-MX">
              <head>
                  <title>Imprimir citas - ${escapeHtml(title)}</title>
                  <style>
                      body { font-family: Arial, Helvetica, sans-serif; padding: 20px; color: #000; }
                      h1 { text-align: center; margin-bottom: 10px; font-size: 24px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                      h2 { font-size: 18px; margin-top: 30px; margin-bottom: 10px; background-color: #eee; padding: 10px; border-radius: 5px; }
                      .meta { text-align: center; margin-bottom: 30px; color: #555; font-size: 14px; }
                      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                      th, td { border: 1px solid #ccc; padding: 8px; text-align: center; font-size: 13px; }
                      th { background-color: #f0f0f0; font-weight: bold; }
                      .total-row { font-weight: bold; background-color: #fafafa; }
                      @media print {
                          body { padding: 0; }
                          button { display: none; }
                          h2 { break-after: avoid; }
                          table { break-inside: auto; }
                          tr { break-inside: avoid; break-after: auto; }
                      }
                  </style>
              </head>
              <body>
                  <h1>${escapeHtml(business.name)}</h1>
                  <div class="meta">Reporte de citas: ${escapeHtml(title)}</div>

                  ${sortedKeys.map(dateKey => {
                      const dayBookings = grouped[dateKey];
                      dayBookings.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

                      const sampleDate = dayBookings[0].date;
                      const { full, weekday } = getFormattedDateParts(sampleDate);

                      return `
                          <div class="date-group">
                              <h2>${escapeHtml(weekday)}, ${escapeHtml(full)}</h2>
                              <table>
                                  <thead>
                                      <tr>
                                          <th width="12%">Hora</th>
                                          <th width="25%">Cliente</th>
                                          <th width="20%">Celular</th>
                                          <th width="28%">Servicios</th>
                                          <th width="15%">Total (MXN)</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      ${dayBookings.map(b => `
                                          <tr>
                                              <td><b>${escapeHtml(formatTime(b.timeSlot))}</b></td>
                                              <td>${escapeHtml(b.customerName)}</td>
                                              <td>${escapeHtml(b.customerPhone)}</td>
                                              <td>${escapeHtml(b.selectedServices.map(s => s.title).join(', '))}</td>
                                              <td>${escapeHtml(formatMXN(b.totalPrice))}</td>
                                          </tr>
                                      `).join('')}
                                  </tbody>
                              </table>
                          </div>
                      `;
                  }).join('')}

                  <script>
                      window.onload = function() { window.print(); }
                  </script>
              </body>
              </html>
          `);
          printWindow.document.close();
      }
  };

  const handleSaveService = async () => {
    if (!editingService?.title || !editingService?.price) return;

    const newService: Service = {
      id: editingService.id || Math.random().toString(36).substr(2, 9),
      title: editingService.title,
      price: Number(editingService.price),
      durationMinutes: Number(editingService.durationMinutes) || 30,
      description: editingService.description || ''
    };

    try {
      await saveService(business.id, newService);
      setEditingService(null);
      loadData(true);
      setNotification({ type: 'success', message: 'Servicio guardado correctamente.' });
    } catch (e) {
      handleActionError(e, 'No se pudo guardar el servicio. Intenta de nuevo.');
    }
  };

  const handleDeleteService = (service: Service) => {
    setServiceToDelete(service);
  };

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;
    try {
      await deleteService(business.id, serviceToDelete.id);
      setServiceToDelete(null);
      loadData(true);
      setNotification({ type: 'success', message: 'Servicio eliminado correctamente.' });
    } catch (e) {
      setServiceToDelete(null);
      handleActionError(e, 'No se pudo eliminar el servicio. Intenta de nuevo.');
    }
  };

  // Mensaje de WhatsApp para avisarle al cliente que su cita se canceló
  const buildCancellationLink = (b: Booking): string => {
    const { weekday, full } = getFormattedDateParts(b.date);
    const firstName = b.customerName.trim().split(/\s+/)[0];
    const services = b.selectedServices.map(s => s.title).join(', ');
    const site = businessUrl;
    const message =
      `Hola ${firstName}, te escribimos de ${business.name}. ` +
      `Tu cita del ${weekday.toLowerCase()} ${full} a las ${formatTime(b.timeSlot)} (${services}) se canceló. ` +
      `Si quieres reagendar, puedes reservar otra aquí: ${site} ¡Gracias!`;
    return buildCustomerWhatsAppLink(b.customerPhone, message);
  };

  const confirmDeleteBooking = async () => {
    if (!bookingToDelete) return;
    try {
      await deleteBooking(business.id, bookingToDelete.id);
      setCancelledBooking(bookingToDelete);
      setBookingToDelete(null);
      loadData(true);
    } catch (e) {
      setBookingToDelete(null);
      handleActionError(e, 'No se pudo cancelar la cita. Intenta de nuevo.');
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await saveBusinessSettings(business.id, settings);
      setNotification({ type: 'success', message: 'Configuración guardada correctamente.' });
    } catch (e) {
      handleActionError(e, 'No se pudo guardar la configuración. Intenta de nuevo.');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleDayOff = (dayIndex: number) => {
      const current = settings.offDays;
      if (current.includes(dayIndex)) {
          setSettings({...settings, offDays: current.filter(d => d !== dayIndex)});
      } else {
          setSettings({...settings, offDays: [...current, dayIndex]});
      }
  };

  const logout = async () => {
      await logoutAdmin(business);
      navigate(path('/admin/login'));
  }

  const getDisplayedBookings = () => {
      if (showTodayOnly) {
          const today = new Date();
          const todayVal = today.getFullYear() * 10000 + today.getMonth() * 100 + today.getDate();

          return bookings
            .filter(b => {
                const bd = new Date(b.date);
                const bdVal = bd.getFullYear() * 10000 + bd.getMonth() * 100 + bd.getDate();
                return bdVal === todayVal;
            })
            .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
      }
      return bookings;
  };

  // Agrupar las citas por fecha para la vista principal
  const groupBookingsByDate = (bookingList: Booking[]) => {
      const groups: { [key: string]: Booking[] } = {};
      bookingList.forEach(b => {
          // Se usa AAAA-M-D como llave para agrupar por día del calendario
          const d = new Date(b.date);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(b);
      });
      return groups;
  };

  const displayedBookings = getDisplayedBookings();
  const groupedBookings = groupBookingsByDate(displayedBookings);

  // Ordenar las fechas de menor a mayor (la más próxima primero)
  const sortedDateKeys = Object.keys(groupedBookings).sort((a, b) => {
      const [yA, mA, dA] = a.split('-').map(Number);
      const [yB, mB, dB] = b.split('-').map(Number);
      const dateA = new Date(yA, mA, dA).getTime();
      const dateB = new Date(yB, mB, dB).getTime();
      return dateA - dateB;
  });

  // id = número de día en JavaScript (0 = domingo ... 6 = sábado)
  const weekDays = [
      { id: 1, label: 'Lunes' },
      { id: 2, label: 'Martes' },
      { id: 3, label: 'Miércoles' },
      { id: 4, label: 'Jueves' },
      { id: 5, label: 'Viernes' },
      { id: 6, label: 'Sábado' },
      { id: 0, label: 'Domingo' },
  ];

  return (
    <div className="space-y-6 pb-20 relative">
      {/* Aviso emergente */}
      {notification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 relative transform animate-in zoom-in-95 duration-200">
                  <button
                      onClick={() => setNotification(null)}
                      className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                  >
                      <X size={20} />
                  </button>

                  <div className="flex flex-col items-center text-center gap-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${notification.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {notification.type === 'success' ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
                      </div>
                      <h3 className="text-xl font-bold text-white">
                          {notification.type === 'success' ? 'Listo' : 'Error'}
                      </h3>
                      <p className="text-slate-400">
                          {notification.message}
                      </p>

                      <button
                          onClick={() => setNotification(null)}
                          className={`mt-2 w-full py-3 rounded-xl font-bold text-white transition-all ${
                              notification.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                          }`}
                      >
                          Entendido
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Ventana para confirmar la eliminación de un servicio */}
      {serviceToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 relative transform animate-in zoom-in-95 duration-200">
                  <button
                      onClick={() => setServiceToDelete(null)}
                      className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                  >
                      <X size={20} />
                  </button>

                  <div className="flex flex-col items-center text-center gap-4">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500/10 text-red-500">
                          <Trash2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white">Eliminar servicio</h3>
                      <p className="text-slate-400">
                          ¿Seguro que quieres eliminar «{serviceToDelete.title}»?
                      </p>

                      <div className="flex gap-3 w-full">
                          <button
                              onClick={() => setServiceToDelete(null)}
                              className="flex-1 py-3 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all"
                          >
                              Cancelar
                          </button>
                          <button
                              onClick={confirmDeleteService}
                              className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all"
                          >
                              Eliminar
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Aviso de cita cancelada, con botón para avisarle al cliente por WhatsApp */}
      {cancelledBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 relative transform animate-in zoom-in-95 duration-200">
                  <button
                      onClick={() => setCancelledBooking(null)}
                      aria-label="Cerrar"
                      className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                  >
                      <X size={20} />
                  </button>

                  <div className="flex flex-col items-center text-center gap-4">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center bg-green-500/10 text-green-500">
                          <CheckCircle2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white">Cita cancelada</h3>
                      <p className="text-slate-400">
                          El horario de las {formatTime(cancelledBooking.timeSlot)} del {getFormattedDateParts(cancelledBooking.date).full} ya quedó libre. ¿Quieres avisarle a {cancelledBooking.customerName.trim().split(/\s+/)[0]} por WhatsApp?
                      </p>

                      <a
                          href={buildCancellationLink(cancelledBooking)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setCancelledBooking(null)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                      >
                          <MessageCircle size={20} />
                          Avisar por WhatsApp
                      </a>
                      <button
                          onClick={() => setCancelledBooking(null)}
                          className="w-full py-3 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all"
                      >
                          Ahora no
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Ventana para confirmar la cancelación de una cita */}
      {bookingToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 relative transform animate-in zoom-in-95 duration-200">
                  <button
                      onClick={() => setBookingToDelete(null)}
                      aria-label="Cerrar"
                      className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                  >
                      <X size={20} />
                  </button>

                  <div className="flex flex-col items-center text-center gap-4">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500/10 text-red-500">
                          <Trash2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white">Cancelar cita</h3>
                      <p className="text-slate-400">
                          ¿Cancelar la cita de {bookingToDelete.customerName} el {getFormattedDateParts(bookingToDelete.date).full} a las {formatTime(bookingToDelete.timeSlot)}? El horario quedará libre. Después podrás avisarle al cliente por WhatsApp.
                      </p>

                      <div className="flex gap-3 w-full">
                          <button
                              onClick={() => setBookingToDelete(null)}
                              className="flex-1 py-3 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all"
                          >
                              Conservar
                          </button>
                          <button
                              onClick={confirmDeleteBooking}
                              className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all"
                          >
                              Cancelar cita
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-black text-white">Panel de administración</h2>
        <button onClick={logout} className="text-red-400 hover:text-red-300 text-sm font-medium border border-red-500/20 px-4 py-2 rounded-lg hover:bg-red-500/10 transition-colors">Cerrar sesión</button>
      </div>

      <div className="flex gap-4 border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('summary')}
          className={`pb-3 px-4 font-medium transition-colors whitespace-nowrap relative ${activeTab === 'summary' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Resumen
          {activeTab === 'summary' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"></div>}
        </button>
        <button
          onClick={() => setActiveTab('bookings')}
          className={`pb-3 px-4 font-medium transition-colors whitespace-nowrap relative ${activeTab === 'bookings' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Citas
          {activeTab === 'bookings' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"></div>}
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`pb-3 px-4 font-medium transition-colors whitespace-nowrap relative ${activeTab === 'services' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Servicios
          {activeTab === 'services' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"></div>}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-4 font-medium transition-colors whitespace-nowrap relative ${activeTab === 'settings' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Configuración
          {activeTab === 'settings' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"></div>}
        </button>
      </div>

      {activeTab === 'summary' && (
        <AdminSummary bookings={bookings} onOpenBookings={() => setActiveTab('bookings')} />
      )}

      {activeTab === 'bookings' && (
        <div className="space-y-6 animate-in fade-in">

          {/* Barra de acciones */}
          <div className="flex flex-col xl:flex-row gap-4 justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                  <button
                      onClick={() => setShowTodayOnly(!showTodayOnly)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                          showTodayOnly
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20 ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-900'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                  >
                      {showTodayOnly ? <CalendarCheck size={18} /> : <Filter size={18} />}
                      {showTodayOnly ? 'Ver todas las citas' : 'Solo citas de hoy'}
                  </button>

                  <button
                    onClick={() => loadData(false)}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 bg-slate-800 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700"
                  >
                    <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    <span>Actualizar</span>
                  </button>

                  <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        autoRefresh
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                      <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
                      {autoRefresh ? 'Actualización automática: sí' : 'Actualización automática: no'}
                  </button>

                  {showTodayOnly && (
                      <span className="text-sm text-amber-500 font-medium animate-pulse ml-2">
                          {displayedBookings.length} {displayedBookings.length === 1 ? 'cita hoy' : 'citas hoy'}
                      </span>
                  )}
              </div>

              <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handlePrint(bookings, 'Todas las citas')}
                    className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    <Printer size={18} />
                    Imprimir todas
                  </button>
                  <button
                    onClick={exportExcel}
                    className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors shadow-lg shadow-green-900/20"
                  >
                    <Download size={18} />
                    Exportar a Excel
                  </button>
              </div>
          </div>

          <div className="space-y-8">
            {sortedDateKeys.length === 0 ? (
                 <div className="bg-slate-900 rounded-xl p-12 text-center border border-slate-800">
                    <CalendarCheck size={48} className="mx-auto text-slate-700 mb-4" />
                    <p className="text-slate-500 text-lg">No hay citas para mostrar.</p>
                 </div>
            ) : (
                sortedDateKeys.map(dateKey => {
                    const dayBookings = groupedBookings[dateKey];
                    // Ordenar las citas del día por hora
                    dayBookings.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

                    const sampleDate = dayBookings[0].date;
                    const { full, weekday } = getFormattedDateParts(sampleDate);

                    return (
                        <div key={dateKey} className="bg-slate-900 rounded-xl shadow-sm overflow-hidden border border-slate-800">
                            {/* Encabezado de la fecha */}
                            <div className="bg-slate-800/50 p-4 border-b border-slate-800 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="bg-amber-500/10 text-amber-500 p-2 rounded-lg">
                                        <CalendarCheck size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg flex flex-wrap items-center gap-x-2">
                                            <span>{weekday},</span>
                                            <span className="text-amber-500">{full}</span>
                                        </h3>
                                        <span className="text-xs text-slate-500">{dayBookings.length} {dayBookings.length === 1 ? 'cita registrada' : 'citas registradas'}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handlePrint(dayBookings, `${weekday} ${full}`)}
                                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                >
                                    <Printer size={14} />
                                    Imprimir
                                </button>
                            </div>

                            {/* Tabla */}
                            <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-950/50 text-slate-400 font-medium border-b border-slate-800">
                                <tr>
                                    <th className="p-4 w-28">Hora</th>
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4">Servicios</th>
                                    <th className="p-4">Total</th>
                                    <th className="p-4 w-16"><span className="sr-only">Acciones</span></th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                {dayBookings.map(booking => (
                                    <tr key={booking.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4">
                                        <div className="bg-slate-800 text-center py-1 px-2 rounded text-amber-500 font-bold border border-slate-700 whitespace-nowrap">
                                            {formatTime(booking.timeSlot)}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-white">{booking.customerName}</div>
                                        <div className="text-slate-500 text-xs font-mono mt-1">{booking.customerPhone}</div>
                                    </td>
                                    <td className="p-4 text-slate-300">
                                        <div className="flex flex-wrap gap-1">
                                            {booking.selectedServices.map((s, idx) => (
                                                <span key={idx} className="bg-slate-800 px-2 py-0.5 rounded text-xs border border-slate-700">
                                                    {s.title}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4 font-bold text-white">
                                        {formatMXN(booking.totalPrice)}
                                    </td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => setBookingToDelete(booking)}
                                            aria-label={`Cancelar la cita de ${booking.customerName}`}
                                            title="Cancelar cita"
                                            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    );
                })
            )}
          </div>
        </div>
      )}

      {activeTab === 'services' && (
        <div className="space-y-6 animate-in fade-in">
            {!editingService ? (
                 <button
                    onClick={() => setEditingService({})}
                    className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700"
                 >
                    <Plus size={18} /> Agregar servicio
                 </button>
            ) : null}

           {editingService && (
               <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 animate-in fade-in slide-in-from-top-4">
                   <h3 className="font-bold text-white">{editingService.id ? 'Editar servicio' : 'Agregar servicio'}</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <input
                          type="text"
                          placeholder="Nombre del servicio"
                          value={editingService.title || ''}
                          onChange={e => setEditingService({...editingService, title: e.target.value})}
                          className="p-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-amber-500 outline-none"
                       />
                       <input
                          type="number"
                          placeholder="Precio (MXN)"
                          value={editingService.price || ''}
                          onChange={e => setEditingService({...editingService, price: Number(e.target.value)})}
                          className="p-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-amber-500 outline-none"
                       />
                       <input
                          type="number"
                          placeholder="Duración (minutos)"
                          value={editingService.durationMinutes || ''}
                          onChange={e => setEditingService({...editingService, durationMinutes: Number(e.target.value)})}
                          className="p-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-amber-500 outline-none"
                       />
                        <input
                          type="text"
                          placeholder="Descripción breve"
                          value={editingService.description || ''}
                          onChange={e => setEditingService({...editingService, description: e.target.value})}
                          className="p-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-amber-500 outline-none"
                       />
                   </div>
                   <div className="flex justify-end gap-3">
                       <button onClick={() => setEditingService(null)} className="px-4 py-2 text-slate-400 hover:bg-slate-800 rounded-lg">Cancelar</button>
                       <button onClick={handleSaveService} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">Guardar</button>
                   </div>
               </div>
           )}

           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {services.map(service => (
                   <div key={service.id} className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm flex justify-between items-start group hover:border-slate-700 transition-all">
                       <div>
                           <h4 className="font-bold text-white text-lg">{service.title}</h4>
                           <p className="text-sm text-slate-400 mt-2">{formatMXN(service.price)} MXN</p>
                           <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Clock size={12}/> {service.durationMinutes} min</p>
                       </div>
                       <div className="flex gap-2">
                           <button onClick={() => setEditingService(service)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors">
                               <Edit2 size={16} />
                           </button>
                           <button onClick={() => handleDeleteService(service)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors">
                               <Trash2 size={16} />
                           </button>
                       </div>
                   </div>
               ))}
           </div>
        </div>
      )}

      {activeTab === 'settings' && (
          <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-xl animate-in fade-in">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                   <Settings className="text-amber-500" size={28} />
                   <h2 className="text-2xl font-bold text-white">Configuración de citas</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Horario de trabajo */}
                  <div className="space-y-4">
                      <h3 className="font-bold text-white text-lg">Horario de trabajo</h3>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-slate-400 text-sm mb-2">Hora de apertura</label>
                              <select
                                value={settings.workStartTime}
                                onChange={(e) => setSettings({...settings, workStartTime: e.target.value})}
                                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500"
                              >
                                  {Array.from({length: 24}, (_, i) => {
                                      const t = `${i.toString().padStart(2, '0')}:00`;
                                      return <option key={t} value={t}>{formatTime(t)}</option>
                                  })}
                              </select>
                          </div>
                          <div>
                              <label className="block text-slate-400 text-sm mb-2">Hora de cierre</label>
                              <select
                                value={settings.workEndTime}
                                onChange={(e) => setSettings({...settings, workEndTime: e.target.value})}
                                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500"
                              >
                                  {Array.from({length: 24}, (_, i) => {
                                      const t = `${i.toString().padStart(2, '0')}:00`;
                                      return <option key={t} value={t}>{formatTime(t)}</option>
                                  })}
                              </select>
                          </div>
                      </div>
                  </div>

                  {/* Descanso */}
                  <div className="space-y-4">
                      <h3 className="font-bold text-white text-lg">Descanso (hora de comida)</h3>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-slate-400 text-sm mb-2">Inicio del descanso</label>
                              <select
                                value={settings.breakStartTime || ''}
                                onChange={(e) => setSettings({...settings, breakStartTime: e.target.value || null})}
                                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500"
                              >
                                  <option value="">Sin descanso</option>
                                  {Array.from({length: 24}, (_, i) => {
                                      const t = `${i.toString().padStart(2, '0')}:00`;
                                      return <option key={t} value={t}>{formatTime(t)}</option>
                                  })}
                              </select>
                          </div>
                          <div>
                              <label className="block text-slate-400 text-sm mb-2">Fin del descanso</label>
                              <select
                                value={settings.breakEndTime || ''}
                                onChange={(e) => setSettings({...settings, breakEndTime: e.target.value || null})}
                                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500"
                              >
                                  <option value="">Sin descanso</option>
                                  {Array.from({length: 24}, (_, i) => {
                                      const t = `${i.toString().padStart(2, '0')}:00`;
                                      return <option key={t} value={t}>{formatTime(t)}</option>
                                  })}
                              </select>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Días de descanso */}
              <div className="mt-8">
                  <h3 className="font-bold text-white text-lg mb-4">Días de descanso</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {weekDays.map(day => (
                          <div
                            key={day.id}
                            onClick={() => toggleDayOff(day.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                                settings.offDays.includes(day.id)
                                ? 'bg-red-500/10 border-red-500 text-red-400'
                                : 'bg-slate-950 border-slate-700 text-slate-400 hover:bg-slate-800'
                            }`}
                          >
                              <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                                  settings.offDays.includes(day.id) ? 'bg-red-500 border-red-500' : 'border-slate-600'
                              }`}>
                                  {settings.offDays.includes(day.id) && <CheckIcon />}
                              </div>
                              <span>{day.label}</span>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Límite de citas por celular */}
              <div className="mt-8">
                  <h3 className="font-bold text-white text-lg mb-2">Citas por cliente</h3>
                  <p className="text-slate-400 text-sm mb-4">
                      Cuántas citas próximas puede tener un mismo celular. Evita que una persona aparte todos los horarios.
                  </p>
                  <label htmlFor="max-citas-por-celular" className="block text-slate-400 text-sm mb-2">Máximo de citas próximas por celular</label>
                  <select
                    id="max-citas-por-celular"
                    value={settings.maxBookingsPerPhone}
                    onChange={(e) => setSettings({...settings, maxBookingsPerPhone: Number(e.target.value)})}
                    className="w-full md:w-48 p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500"
                  >
                      {Array.from({length: 20}, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n}</option>
                      ))}
                  </select>
              </div>

              {/* Botón de guardar */}
              <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-900/20 hover:bg-green-700 transition-all disabled:opacity-50"
                  >
                      {savingSettings ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={20} />}
                      Guardar cambios
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12"></polyline></svg>
);

export default AdminDashboard;
