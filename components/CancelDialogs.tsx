import React from 'react';
import { AlertTriangle, MessageCircle, X, XCircle } from 'lucide-react';
import { MyBooking } from '../types';
import { formatTime } from '../services/format';
import { ticketDateText } from '../services/ticket';

interface ConfirmProps {
  ticket: MyBooking;
  busy: boolean;
  onKeep: () => void;
  onConfirm: () => void;
}

// Ventana para confirmar la cancelación de una cita
export const CancelConfirmModal: React.FC<ConfirmProps> = ({ ticket, busy, onKeep, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancelar-titulo"
      className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 relative transform animate-in zoom-in-95 duration-200"
    >
      <button
        onClick={onKeep}
        aria-label="Cerrar"
        className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
      >
        <X size={20} />
      </button>

      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500/10 text-red-500">
          <AlertTriangle size={32} />
        </div>
        <h3 id="cancelar-titulo" className="text-xl font-bold text-white">¿Cancelar tu cita?</h3>
        <p className="text-slate-300">
          {ticketDateText(ticket)}, {formatTime(ticket.timeSlot)}
        </p>
        <p className="text-slate-400 text-sm">La hora se le ofrece a alguien más.</p>
        <div className="flex gap-3 w-full">
          <button
            onClick={onKeep}
            disabled={busy}
            className="flex-1 py-3 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all"
          >
            Conservar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-3 rounded-xl font-bold text-paper bg-red-600 hover:bg-red-700 transition-all disabled:opacity-60"
          >
            {busy ? 'Cancelando...' : 'Sí, cancelar'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

interface CancelledProps {
  ticket: MyBooking;
  whatsappHref: string;
  onRebook: () => void;
  onClose: () => void;
  closeLabel?: string;
}

// Lo que se ve cuando la cita ya quedó cancelada: la fecha tachada y cómo apartar otra hora
export const CancelledNotice: React.FC<CancelledProps> = ({ ticket, whatsappHref, onRebook, onClose, closeLabel = 'Ahora no' }) => (
  <div className="flex flex-col items-center text-center gap-4">
    <div className="w-16 h-16 rounded-full flex items-center justify-center bg-slate-800 text-slate-300">
      <XCircle size={32} />
    </div>
    <h3 className="text-2xl font-black text-white">Tu cita quedó cancelada</h3>
    <div className="bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 w-full text-slate-500">
      <p className="line-through">{ticketDateText(ticket)}</p>
      <p className="line-through text-lg font-bold">{formatTime(ticket.timeSlot)}</p>
      {ticket.folio && <p className="line-through text-xs mt-1 tracking-[0.3em]">{ticket.folio}</p>}
    </div>
    <p className="text-slate-400 text-sm">El horario ya quedó libre. ¿Quieres apartar otro?</p>

    <button
      onClick={onRebook}
      className="sticker w-full bg-amber-500 text-black py-3 rounded-xl font-extrabold hover:bg-amber-400"
    >
      Apartar otra hora
    </button>
    <a
      href={whatsappHref}
      target="_blank"
      rel="noreferrer"
      className="w-full bg-green-600 hover:bg-green-700 text-paper py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
    >
      <MessageCircle size={20} />
      Avisar al negocio por WhatsApp
    </a>
    <button
      onClick={onClose}
      className="w-full py-3 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all"
    >
      {closeLabel}
    </button>
  </div>
);
