import { Scissors, Sparkles, Smile, Apple, Stethoscope, CalendarCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Cada giro (category del negocio) trae un ícono y las frases de la cinta superior.
// Para agregar un giro nuevo, agrégalo aquí; si el giro no está en la lista, se usa "otro".
export type IconComponent = LucideIcon;

export interface CategoryPreset {
  label: string;
  icon: IconComponent;
  ticker: string[];
}

export const CATEGORIES: Record<string, CategoryPreset> = {
  barberia: {
    label: 'Barbería',
    icon: Scissors,
    ticker: ['Corte fresco', 'Flow real', 'Reserva tu cita', 'Barba al punto'],
  },
  spa: {
    label: 'Spa',
    icon: Sparkles,
    ticker: ['Relájate', 'Cuida de ti', 'Reserva tu cita', 'Un momento para ti'],
  },
  estetica: {
    label: 'Estética',
    icon: Sparkles,
    ticker: ['Luce increíble', 'Cuida de ti', 'Reserva tu cita', 'Estilo y bienestar'],
  },
  dentista: {
    label: 'Dentista',
    icon: Smile,
    ticker: ['Sonrisa sana', 'Cuida tu sonrisa', 'Reserva tu cita', 'Sin llamadas'],
  },
  nutriologo: {
    label: 'Nutriólogo',
    icon: Apple,
    ticker: ['Come bien', 'Tu plan, tu ritmo', 'Reserva tu cita', 'Sin llamadas'],
  },
  medico: {
    label: 'Consultorio médico',
    icon: Stethoscope,
    ticker: ['Tu salud primero', 'Reserva tu cita', 'Sin filas', 'Sin llamadas'],
  },
  otro: {
    label: 'Servicios',
    icon: CalendarCheck,
    ticker: ['Reserva tu cita', 'Rápido y fácil', 'Desde tu celular', 'Sin llamadas'],
  },
};

export const getCategory = (key: string): CategoryPreset => CATEGORIES[key] || CATEGORIES.otro;
