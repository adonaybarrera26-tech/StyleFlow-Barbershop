import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, Calendar, Clock, X, CheckCircle2, MessageCircle, AlertTriangle } from 'lucide-react';
import { MyBooking } from '../../types';
import { getMyBookings, cancelMyBooking } from '../../services/dataService';
import { useBusiness } from '../../services/BusinessContext';
import { getCategory } from '../../services/categories';
import { buildWhatsAppLink, formatMXN, formatTime, getDateParts, isValidMexicanPhone } from '../../services/format';

const PHONE_ERROR = 'Escribe un número de celular válido de 10 dígitos.';

// Mensaje para avisarle al negocio que se canceló la cita (no lleva el nombre: el cliente ya escribe desde su WhatsApp)
const buildCancelMessage = (businessName: string, b: MyBooking): string => {
  const { weekday, full } = getDateParts(new Date(b.date));
  return (
    `Hola, cancelé mi cita en ${businessName}:\n` +
    `• Fecha: ${weekday}, ${full}\n` +
    `• Hora: ${formatTime(b.timeSlot)}\n` +
    `• Servicios: ${b.services.map(s => s.title).join(', ')}\n` +
    `Gracias por su atención.`
  );
};

const MyBookingsPage: React.FC = () => {
  const { business, path } = useBusiness();
  const { icon: CategoryIcon } = getCategory(business.category);
  const [phone, setPhone] = useState('');
  // Celular con el que se hizo la última búsqueda (con ese mismo se cancela)
  const [searchedPhone, setSearchedPhone] = useState<string | null>(null);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingToCancel, setBookingToCancel] = useState<MyBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelledBooking, setCancelledBooking] = useState<MyBooking | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidMexicanPhone(phone)) {
      setError(PHONE_ERROR);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const list = await getMyBookings(business.id, phone.trim());
      setBookings(list);
      setSearchedPhone(phone.trim());
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setSearchedPhone(null);
      setError(code === 'invalid_phone' ? PHONE_ERROR : 'No pudimos buscar tus citas. Revisa tu internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const confirmCancel = async () => {
    if (!bookingToCancel || !searchedPhone) return;
    const target = bookingToCancel;
    setCancelling(true);
    try {
      const done = await cancelMyBooking(business.id, target.id, searchedPhone);
      setBookingToCancel(null);
      if (done) {
        setBookings(prev => prev.filter(b => b.id !== target.id));
        setCancelledBooking(target);
      } else {
        setError('No se pudo cancelar. Puede que la cita ya se haya cancelado o que ya haya pasado.');
        try {
          setBookings(await getMyBookings(business.id, searchedPhone));
        } catch (refreshError) {
          console.error('No se pudo actualizar la lista', refreshError);
        }
      }
    } catch (err) {
      setBookingToCancel(null);
      setError('No pudimos cancelar tu cita. Revisa tu internet e intenta de nuevo.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      <div>
        <h2 className="text-3xl font-bold text-white">Mis reservas</h2>
        <p className="text-slate-400 mt-1">Escribe el celular con el que reservaste para ver y cancelar tus citas.</p>
      </div>

      <form onSubmit={handleSearch} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div>
          <label htmlFor="mis-reservas-celular" className="block text-sm font-medium text-slate-400 mb-2">Celular (WhatsApp)</label>
          <input
            id="mis-reservas-celular"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(''); setSearchedPhone(null); }}
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
            placeholder="55 1234 5678"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="sticker w-full bg-amber-500 text-black py-3 rounded-xl font-extrabold hover:bg-amber-400 flex justify-center items-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
          {loading ? 'Buscando...' : 'Buscar mis citas'}
        </button>
      </form>

      {error && (
        <p className="text-red-500 text-sm text-center bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20" role="alert">{error}</p>
      )}

      {searchedPhone !== null && bookings.length === 0 && (
        <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 text-center space-y-4">
          <CategoryIcon className="mx-auto text-slate-600" size={32} />
          <p className="text-slate-300">No encontramos citas próximas con ese número.</p>
          <Link
            to={path('/booking')}
            className="sticker inline-block bg-amber-500 text-black px-6 py-3 rounded-xl font-extrabold hover:bg-amber-400"
          >
            Reservar una cita
          </Link>
        </div>
      )}

      {searchedPhone !== null && bookings.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Se muestran tus citas de hoy en adelante.</p>
          {bookings.map(b => {
            const { weekday, full } = getDateParts(new Date(b.date));
            return (
              <div key={b.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="text-amber-500 font-bold flex items-center gap-2"><Calendar size={16} /> {weekday}</p>
                    <p className="text-slate-300 text-sm">{full}</p>
                  </div>
                  <p className="text-white font-bold text-xl flex items-center gap-2 whitespace-nowrap"><Clock size={18} className="text-slate-500" /> {formatTime(b.timeSlot)}</p>
                </div>

                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Servicios</span>
                    <span className="text-slate-200 text-right">{b.services.map(s => s.title).join(', ')}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Duración</span>
                    <span className="text-slate-200">{b.totalDuration} min</span>
                  </div>
                  <div className="flex justify-between gap-4 pt-2 border-t border-slate-800">
                    <span className="text-slate-400 font-medium">Total a pagar en el local</span>
                    <span className="text-amber-500 font-bold">{formatMXN(b.totalPrice)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setBookingToCancel(b)}
                  className="w-full py-3 rounded-xl font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                >
                  Cancelar cita
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Ventana para confirmar la cancelación */}
      {bookingToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 relative transform animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setBookingToCancel(null)}
              aria-label="Cerrar"
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500/10 text-red-500">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-white">¿Cancelar tu cita?</h3>
              <p className="text-slate-400">
                Tu cita del {getDateParts(new Date(bookingToCancel.date)).full} a las {formatTime(bookingToCancel.timeSlot)} se va a cancelar y el horario quedará libre.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setBookingToCancel(null)}
                  disabled={cancelling}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all"
                >
                  Conservar
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={cancelling}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-60"
                >
                  {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de cita cancelada, con botón para avisarle al negocio por WhatsApp */}
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
                Tu cita del {getDateParts(new Date(cancelledBooking.date)).full} a las {formatTime(cancelledBooking.timeSlot)} ya quedó cancelada. ¿Quieres avisarle al negocio por WhatsApp?
              </p>

              <a
                href={buildWhatsAppLink(business, buildCancelMessage(business.name, cancelledBooking))}
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
    </div>
  );
};

export default MyBookingsPage;
