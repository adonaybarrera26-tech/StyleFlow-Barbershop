import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { BookingStatus } from '../types';

// Etiqueta del estado de una cita: "Confirmada" o "Por confirmar"
const StatusChip: React.FC<{ status?: BookingStatus; className?: string }> = ({ status, className = '' }) =>
  status === 'confirmed' ? (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1 text-xs font-bold ${className}`}>
      <CheckCircle2 size={14} aria-hidden="true" /> Confirmada
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 px-3 py-1 text-xs font-bold ${className}`}>
      <Clock size={14} aria-hidden="true" /> Por confirmar
    </span>
  );

export default StatusChip;
