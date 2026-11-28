import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, MapPin, Calendar, Clock, Navigation, MessageCircle, CalendarPlus, Download, RefreshCw, Loader2 } from 'lucide-react';
import { TicketState } from '../../types';
import { useBusiness } from '../../services/BusinessContext';
import { cancelMyBooking } from '../../services/dataService';
import { buildWhatsAppLink, buildMapsLink, formatMXN, formatTime } from '../../services/format';
import {
  buildCancelMessage,
  buildConfirmMessage,
  downloadIcs,
  relativeDayText,
  saveTicketImage,
  ticketDateText
} from '../../services/ticket';
import { CancelConfirmModal, CancelledNotice } from '../../components/CancelDialogs';

const SuccessPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { business, path } = useBusiness();
  const state = location.state as TicketState | null;

  const [askCancel, setAskCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [note, setNote] = useState('');

  // Si se entra directo a esta página sin datos, regresar al inicio
  useEffect(() => {
    if (!state || !state.ticket) {
      navigate(path('/'));
    }
  }, [state, navigate, path]);

  if (!state || !state.ticket) return null;

  const { ticket, phone, customerName, rescheduled } = state;
  const firstName = (customerName || '').trim().split(/\s+/)[0];

  // Si la cita fue en una sucursal, dirección y mapa son los de esa sucursal
  const place = ticket.locationName
    ? { address: ticket.locationAddress || business.address, mapsUrl: ticket.locationMapsUrl || '' }
    : { address: business.address, mapsUrl: business.mapsUrl };
  const mapLink = buildMapsLink(place);
  const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(place.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const ticketContext = { businessName: business.name, address: place.address };

  const rebook = () => navigate(path('/booking'), { state: { prefill: { customerName, phone } } });

  const reschedule = () => navigate(path('/booking'), { state: { reschedule: { ticket, phone, customerName } } });

  const confirmCancel = async () => {
    setCancelling(true);
    setCancelError('');
    try {
      const done = await cancelMyBooking(business.id, ticket.id, phone);
      setAskCancel(false);
      if (done) {
        setCancelled(true);
      } else {
        setCancelError('No se pudo cancelar. Puede que la cita ya se haya cancelado o que ya haya pasado.');
      }
    } catch (e) {
      setAskCancel(false);
      setCancelError('No pudimos cancelar tu cita. Revisa tu internet e intenta de nuevo.');
    } finally {
      setCancelling(false);
    }
  };

  const handleImage = async () => {
    setSavingImage(true);
    setNote('');
    try {
      const result = await saveTicketImage(ticket, ticketContext);
      if (result === 'downloaded') setNote('Listo: la imagen quedó en tus descargas.');
    } catch (e) {
      console.error('No se pudo guardar la imagen', e);
      setNote('No pudimos crear la imagen. Toma una captura de pantalla del ticket.');
    } finally {
      setSavingImage(false);
    }
  };

  if (cancelled) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center py-8 animate-in zoom-in-95 duration-300">
        <div className="bg-slate-900 w-full max-w-md rounded-3xl border border-slate-800 p-8 shadow-2xl">
          <CancelledNotice
            ticket={ticket}
            whatsappHref={buildWhatsAppLink(business, buildCancelMessage(ticket, business.name))}
            onRebook={rebook}
            onClose={() => navigate(path('/'))}
            closeLabel="Ir al inicio"
          />
        </div>
      </div>
    );
  }

  const title = rescheduled
    ? 'Tu cita quedó reagendada'
    : firstName
      ? `¡Listo, ${firstName}!`
      : '¡Tu cita está reservada!';

  return (
    <div className="flex flex-col items-center py-6 animate-in zoom-in-95 duration-500">
      <div className="w-full max-w-md space-y-5">

        {/* Aviso principal */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="text-green-500 w-8 h-8" aria-hidden="true" />
          </div>
          <h2 className="text-3xl font-black text-white">{title}</h2>
          <p className="text-slate-300 text-lg">
            Te esperamos <span className="text-amber-500 font-bold">{relativeDayText(ticket)}</span> a las{' '}
            <span className="text-white font-bold">{formatTime(ticket.timeSlot)}</span>
          </p>
        </div>

        {/* Ticket */}
        <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
          <div className="h-3 pole" aria-hidden="true" />

          <div className="px-6 pt-6 pb-6 text-center">
            <p className="text-slate-500 text-sm">{business.name}</p>
            {ticket.folio ? (
              <>
                <p className="font-display text-6xl leading-none tracking-[0.18em] text-amber-500 mt-3 pl-[0.18em]" aria-label={`Folio ${ticket.folio}`}>
                  {ticket.folio}
                </p>
                <p className="text-slate-500 text-xs mt-2">Folio de tu cita</p>
              </>
            ) : (
              <p className="font-display text-3xl text-amber-500 mt-3">Tu cita</p>
            )}
          </div>

          {/* Línea de corte del boleto */}
          <div className="relative border-t-2 border-dashed border-slate-700" aria-hidden="true">
            <div className="absolute -left-4 -top-4 w-8 h-8 bg-slate-950 rounded-full"></div>
            <div className="absolute -right-4 -top-4 w-8 h-8 bg-slate-950 rounded-full"></div>
          </div>

          <div className="p-6 space-y-3">
            {ticket.locationName && (
              <div className="flex justify-between items-start gap-4">
                <span className="text-slate-500 text-sm flex items-center gap-1 shrink-0"><MapPin size={14} aria-hidden="true" /> Sucursal</span>
                <span className="text-white font-bold text-right">{ticket.locationName}</span>
              </div>
            )}
            <div className="flex justify-between items-start gap-4">
              <span className="text-slate-500 text-sm flex items-center gap-1 shrink-0"><Calendar size={14} aria-hidden="true" /> Fecha</span>
              <span className="text-amber-500 font-bold text-right">{ticketDateText(ticket)}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-slate-500 text-sm flex items-center gap-1 shrink-0"><Clock size={14} aria-hidden="true" /> Hora de llegada</span>
              <span className="text-white font-bold text-xl">{formatTime(ticket.timeSlot)}</span>
            </div>
            <div className="flex justify-between items-start gap-4 pt-3 border-t border-slate-800">
              <span className="text-slate-500 text-sm shrink-0">Servicios</span>
              <span className="text-slate-200 text-right text-sm">{ticket.services.map(s => s.title).join(', ')}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-slate-500 text-sm">Total a pagar en el local</span>
              <span className="text-amber-500 font-bold">{formatMXN(ticket.totalPrice)}</span>
            </div>
          </div>
        </div>

        {/* Calendario e imagen */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => downloadIcs(ticket, ticketContext)}
            className="bg-slate-800 hover:bg-slate-700 text-white py-3 px-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <CalendarPlus size={18} aria-hidden="true" />
            Agregar al calendario
          </button>
          <button
            onClick={handleImage}
            disabled={savingImage}
            className="bg-slate-800 hover:bg-slate-700 text-white py-3 px-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            {savingImage ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
            Guardar imagen
          </button>
        </div>
        {note && <p className="text-slate-400 text-sm text-center" role="status">{note}</p>}

        {/* Confirmar por WhatsApp */}
        <a
          href={buildWhatsAppLink(business, buildConfirmMessage(ticket, business.name, customerName))}
          target="_blank"
          rel="noreferrer"
          className="w-full bg-green-600 hover:bg-green-700 text-paper py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
        >
          <MessageCircle size={20} aria-hidden="true" />
          Confirmar por WhatsApp
        </a>

        {/* Reagendar y cancelar */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={reschedule}
            className="py-3 rounded-xl font-bold text-slate-200 bg-slate-900 border border-slate-700 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Reagendar
          </button>
          <button
            onClick={() => { setCancelError(''); setAskCancel(true); }}
            className="py-3 rounded-xl font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm"
          >
            Cancelar cita
          </button>
        </div>
        {cancelError && (
          <p className="text-red-500 text-sm text-center bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20" role="alert">{cancelError}</p>
        )}

        {/* Dirección y mapa */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 text-left bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <MapPin className="text-red-500 shrink-0 mt-1" size={20} aria-hidden="true" />
            <div className="flex-1">
              <h4 className="text-white font-bold text-sm mb-1">Dirección</h4>
              <p className="text-slate-300 text-sm leading-relaxed">{place.address}</p>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden h-40 border border-slate-700 relative group">
            <iframe
              title="Mapa"
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={mapEmbed}
              className="opacity-70 group-hover:opacity-100 transition-opacity"
            ></iframe>
          </div>

          <a
            href={mapLink}
            target="_blank"
            rel="noreferrer"
            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Navigation size={18} aria-hidden="true" />
            Cómo llegar
          </a>
        </div>

        <p className="text-slate-500 text-xs text-center">
          Para ver todas tus citas entra a <Link to={path('/mis-reservas')} className="text-amber-500 underline">Mis reservas</Link> con tu celular.
        </p>
      </div>

      {askCancel && (
        <CancelConfirmModal ticket={ticket} busy={cancelling} onKeep={() => setAskCancel(false)} onConfirm={confirmCancel} />
      )}
    </div>
  );
};

export default SuccessPage;
