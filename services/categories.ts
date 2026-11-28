import { Scissors, Sparkles, Smile, Apple, Stethoscope, CalendarCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HeroArt, ThemeKey } from './themes';

// Cada giro (category del negocio) trae un ícono y las frases de la cinta superior.
// Para agregar un giro nuevo, agrégalo aquí; si el giro no está en la lista, se usa "otro".
export type IconComponent = LucideIcon;

export interface CategoryPreset {
  label: string;
  icon: IconComponent;
  ticker: string[];
  theme: ThemeKey; // colores, letra y formas que usa por defecto (services/themes.ts)
  hero: HeroArt; // ilustración de la portada
  health?: boolean; // consultorios: se avisa que para reservar no hace falta contar nada de salud
}

export const CATEGORIES: Record<string, CategoryPreset> = {
  barberia: {
    label: 'Barbería',
    icon: Scissors,
    ticker: ['Corte fresco', 'Flow real', 'Reserva tu cita', 'Barba al punto'],
    theme: 'barberia',
    hero: 'vinyl',
  },
  spa: {
    label: 'Spa',
    icon: Sparkles,
    ticker: ['Respira hondo', 'Cuida de ti', 'Reserva tu cita', 'Un momento para ti'],
    theme: 'spa',
    hero: 'ripple',
  },
  estetica: {
    label: 'Estética',
    icon: Sparkles,
    ticker: ['Luce increíble', 'Cuida de ti', 'Reserva tu cita', 'Estilo y bienestar'],
    theme: 'spa',
    hero: 'ripple',
  },
  dentista: {
    label: 'Dentista',
    icon: Smile,
    ticker: ['Sonrisa sana', 'Cuida tu sonrisa', 'Reserva tu cita', 'Sin llamadas'],
    theme: 'clinica',
    hero: 'tooth',
    health: true,
  },
  nutriologo: {
    label: 'Nutriólogo',
    icon: Apple,
    ticker: ['Come rico', 'Tu plan, tu ritmo', 'Reserva tu cita', 'Sin llamadas'],
    theme: 'natural',
    hero: 'plate',
    health: true,
  },
  medico: {
    label: 'Consultorio médico',
    icon: Stethoscope,
    ticker: ['Tu salud primero', 'Reserva tu cita', 'Sin filas', 'Sin llamadas'],
    theme: 'clinica',
    hero: 'ripple',
    health: true,
  },
  estudio: {
    label: 'Estudio de pole, yoga o baile',
    icon: Sparkles,
    ticker: ['Descubre tu esencia', 'Fuerza y gracia', 'Reserva tu clase', 'Cupo limitado'],
    theme: 'esencia',
    hero: 'logo',
  },
  otro: {
    label: 'Servicios',
    icon: CalendarCheck,
    ticker: ['Reserva tu cita', 'Rápido y fácil', 'Desde tu celular', 'Sin llamadas'],
    theme: 'clinica',
    hero: 'ripple',
  },
};

export const getCategory = (key: string): CategoryPreset => CATEGORIES[key] || CATEGORIES.otro;
