import { Business } from '../types';
import { getCategory } from './categories';

// ============================================================
// TEMAS: cada giro se ve distinto (colores, letra, formas y portada)
// ============================================================
// Un tema cambia variables CSS (colores, tipografía, esquinas, sombras) y la app lo aplica
// en <html>. Las pantallas siguen usando las mismas clases de Tailwind:
//   slate-950 = fondo de la página      slate-900 = tarjetas      slate-800/700 = bordes
//   slate-400 = texto secundario        slate-300/200 = texto     white = título (la "tinta")
//   amber-500 = color principal         black = texto sobre el color principal
// (los nombres "slate" y "amber" son heredados del diseño original de la barbería).

export type ThemeKey = 'barberia' | 'spa' | 'clinica' | 'natural';
export type HeroArt = 'vinyl' | 'ripple' | 'tooth' | 'plate';

type Ramp = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;
type Surface = Ramp & { 950: string };

export interface ThemePreset {
  key: ThemeKey;
  label: string;
  mode: 'dark' | 'light';
  surface: Surface; // escala de superficies y textos (slate)
  accent: string | Ramp; // color principal: un color (se genera la escala) o la escala completa
  ink: string; // títulos
  fonts: { display: string; body: string; href: string | null };
  radius: { lg: string; xl: string; '2xl': string; '3xl': string };
  caps: boolean; // títulos en mayúsculas
  headingWeight: number; // grosor de los títulos
  headingLeading: number; // interlineado de los títulos grandes (Anton es angosta y aguanta 0.95)
  hard: boolean; // sombras duras tipo sticker (true) o sombras suaves (false)
  // Cinta de frases (los valores pueden usar las variables de color, así siguen al color de marca)
  ticker: { bg: string; fg: string; border: string; style: string; size: string; tracking: string };
  pole: string; // fondo del encabezado de "cita confirmada"
  grain: number; // textura de grano (0 a 1)
  stamp: string; // color del sello "Reservado" (variable de color)
  art: [string, string, string]; // colores de la ilustración de la portada
}

// ---------- utilidades de color ----------

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();

const triplet = (hex: string): string => hexToRgb(hex).join(' ');

const toHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
};

const fromHsl = (h: number, s: number, l: number): string => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};

const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Contraste WCAG entre dos colores (4.5 o más = texto normal legible)
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const isHex = (value: string): boolean => /^#[0-9a-fA-F]{6}$/.test(value);

// ---------- escala del color principal ----------

// A partir de UN color se arma la escala 50-900. El paso 500 se usa como botón (con texto encima)
// y como texto sobre las tarjetas (precios, fechas), así que se ajusta hasta que ambos se lean bien:
//  - temas oscuros: se aclara hasta contrastar con el fondo y las tarjetas; los pasos 300-400 son más claros.
//  - temas claros: se oscurece hasta contrastar con el fondo y con el texto blanco del botón;
//    los pasos 300-400 son más oscuros (también se usan como texto).
export const buildAccentRamp = (base: string, mode: 'dark' | 'light', surfaces: string[]): Ramp => {
  const [h, s0, l0] = toHsl(base);
  const s = s0 < 0.08 ? s0 : clamp(s0, 0.25, 1); // los grises se quedan grises
  const MIN = 4.7;
  if (mode === 'dark') {
    let l = clamp(l0, 0.5, 0.72);
    while (l < 0.92 && Math.min(...surfaces.map(bg => contrast(fromHsl(h, s, l), bg))) < MIN) l += 0.01;
    const at = (dl: number, ds = 0) => fromHsl(h, clamp(s + ds, 0, 1), clamp(l + dl, 0.04, 0.97));
    return {
      50: at(0.42, -0.1), 100: at(0.34, -0.05), 200: at(0.24), 300: at(0.13), 400: at(0.06),
      500: at(0), 600: at(-0.02), 700: at(-0.1), 800: at(-0.2), 900: at(-0.32),
    };
  }
  let l = clamp(l0, 0.2, 0.5);
  while (l > 0.1 && Math.min(contrast(fromHsl(h, s, l), '#FFFFFF'), ...surfaces.map(bg => contrast(fromHsl(h, s, l), bg))) < MIN) l -= 0.01;
  const at = (dl: number, ds = 0) => fromHsl(h, clamp(s + ds, 0, 1), clamp(l + dl, 0.05, 0.97));
  return {
    50: at(0.47, -0.1), 100: at(0.4, -0.05), 200: at(0.3), 300: at(-0.1), 400: at(-0.05),
    500: at(0), 600: at(-0.04), 700: at(-0.1), 800: at(-0.17), 900: at(-0.24),
  };
};

// ---------- los 4 temas ----------

const BARBERIA_ACCENT: Ramp = {
  50: '#FFF8DB', 100: '#FFEFB0', 200: '#FFE27A', 300: '#FFD43B', 400: '#FFCC1F',
  500: '#F2B705', 600: '#F2B705', 700: '#D99A00', 800: '#A87A00', 900: '#5A4300',
};

export const THEMES: Record<ThemeKey, ThemePreset> = {
  // Oro y negro "90s": cartel de disco, sticker y poste de barbero
  barberia: {
    key: 'barberia',
    label: 'Barbería',
    mode: 'dark',
    surface: {
      50: '#FAF4E3', 100: '#F1E8D0', 200: '#E4DBC4', 300: '#CFC6B0', 400: '#A89F8A', 500: '#857A66',
      600: '#5C5242', 700: '#3A3326', 800: '#221E17', 900: '#15130F', 950: '#0B0A08',
    },
    accent: BARBERIA_ACCENT,
    ink: '#FFFFFF',
    fonts: { display: "'Anton', Impact, sans-serif", body: "'Archivo', system-ui, sans-serif", href: null },
    radius: { lg: '0.25rem', xl: '0.25rem', '2xl': '0.375rem', '3xl': '0.375rem' },
    caps: true,
    headingWeight: 400,
    headingLeading: 0.95,
    hard: true,
    ticker: { bg: 'rgb(var(--accent-500))', fg: 'rgb(var(--on-accent))', border: '3px solid rgb(var(--slate-950))', style: 'normal', size: '0.95rem', tracking: '0.08em' },
    pole: 'repeating-linear-gradient(-45deg, rgb(var(--accent-500)) 0 12px, rgb(var(--slate-950)) 12px 24px)',
    grain: 0.07,
    stamp: '230 57 70',
    art: ['rgb(var(--accent-500))', '#0B0A08', '#1D1A14'],
  },

  // Spa de noche: ciruela profunda y rosa cuarzo, letras de libro y formas suaves
  spa: {
    key: 'spa',
    label: 'Spa',
    mode: 'dark',
    surface: {
      50: '#FAF6FB', 100: '#F0E9F3', 200: '#E4DBEA', 300: '#D0C4D8', 400: '#B3A3BD', 500: '#8D7B9A',
      600: '#6A5778', 700: '#4B3A57', 800: '#33263D', 900: '#241A2C', 950: '#1A1220',
    },
    accent: '#E8A598',
    ink: '#FFF8F6',
    fonts: {
      display: "'Cardo', Georgia, serif",
      body: "'DM Sans', system-ui, sans-serif",
      href: 'https://fonts.googleapis.com/css2?family=Cardo:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@400;500;600;700&display=swap',
    },
    radius: { lg: '0.75rem', xl: '1.25rem', '2xl': '1.75rem', '3xl': '2.25rem' },
    caps: false,
    headingWeight: 400,
    headingLeading: 1.05,
    hard: false,
    ticker: { bg: 'rgb(var(--slate-800))', fg: 'rgb(var(--accent-300))', border: '1px solid rgb(var(--accent-500) / 0.35)', style: 'italic', size: '1.05rem', tracking: '0.02em' },
    pole: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-700)) 55%, rgb(var(--slate-700)) 100%)',
    grain: 0,
    stamp: 'var(--accent-500)',
    art: ['rgb(var(--accent-500))', 'rgb(var(--accent-300))', 'rgb(var(--accent-700))'],
  },

  // Consultorio: porcelana y azul agua, letras redondeadas y limpias
  clinica: {
    key: 'clinica',
    label: 'Clínica',
    mode: 'light',
    surface: {
      50: '#0C1B29', 100: '#172A3C', 200: '#263A4D', 300: '#3A4F63', 400: '#51667A', 500: '#6B7F91',
      600: '#A3B6C4', 700: '#C8D6E0', 800: '#E1EAF0', 900: '#FFFFFF', 950: '#F3F8FB',
    },
    accent: '#0F7B8A',
    ink: '#0B2236',
    fonts: {
      display: "'Poppins', system-ui, sans-serif",
      body: "'DM Sans', system-ui, sans-serif",
      href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap',
    },
    radius: { lg: '0.625rem', xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.75rem' },
    caps: false,
    headingWeight: 600,
    headingLeading: 1.1,
    hard: false,
    ticker: { bg: 'rgb(var(--accent-500))', fg: 'rgb(var(--on-accent))', border: '0', style: 'normal', size: '0.9rem', tracking: '0.04em' },
    pole: 'linear-gradient(135deg, rgb(var(--accent-600)) 0%, rgb(var(--accent-500)) 60%, rgb(var(--accent-200)) 140%)',
    grain: 0,
    stamp: 'var(--accent-500)',
    art: ['rgb(var(--accent-500))', 'rgb(var(--accent-200))', '#FFFFFF'],
  },

  // Nutrición: avena y verde hoja, letras con calidez y formas orgánicas
  natural: {
    key: 'natural',
    label: 'Natural',
    mode: 'light',
    surface: {
      50: '#0F160E', 100: '#1B2519', 200: '#2B372A', 300: '#3F4C3B', 400: '#566451', 500: '#6F7D68',
      600: '#A8B290', 700: '#CBD3B5', 800: '#E3E8D5', 900: '#FCFDF8', 950: '#F5F7EC',
    },
    accent: '#2F7D3E',
    ink: '#14210F',
    fonts: {
      display: "'Lora', Georgia, serif",
      body: "'Source Sans 3', system-ui, sans-serif",
      href: 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,700;1,500&family=Source+Sans+3:wght@400;500;600;700&display=swap',
    },
    radius: { lg: '0.75rem', xl: '1rem', '2xl': '1.5rem', '3xl': '2rem' },
    caps: false,
    headingWeight: 700,
    headingLeading: 1.08,
    hard: false,
    ticker: { bg: 'rgb(var(--accent-500))', fg: '#FDF6E3', border: '0', style: 'italic', size: '1rem', tracking: '0.02em' },
    pole: 'linear-gradient(135deg, rgb(var(--accent-600)) 0%, rgb(var(--accent-500)) 55%, #F2A93B 150%)',
    grain: 0,
    stamp: '194 65 12',
    art: ['#3E9B4F', '#F2A93B', '#E4572E'],
  },
};

export const DEFAULT_THEME: ThemeKey = 'barberia';

// Look de las pantallas que no son de un negocio (portada de la plataforma, errores)
export const DEFAULT_LOOK = { theme: DEFAULT_THEME, category: 'barberia', brandColor: '' };

// Tema de un negocio: el que se eligió para él o, si no, el de su giro
export const resolveThemeKey = (business: Pick<Business, 'theme' | 'category'>): ThemeKey => {
  if (business.theme && business.theme in THEMES) return business.theme as ThemeKey;
  return getCategory(business.category).theme;
};

// ---------- aplicar el tema a la página ----------

const setVars = (root: HTMLElement, vars: Record<string, string>) => {
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
};

export interface ComputedTheme {
  preset: ThemePreset;
  vars: Record<string, string>;
}

// Calcula todas las variables CSS de un negocio (sin tocar la página): sirve para pruebas
export const computeTheme = (business: Pick<Business, 'theme' | 'category' | 'brandColor'>): ComputedTheme => {
  const preset = THEMES[resolveThemeKey(business)];
  const surfaces = [preset.surface[950], preset.surface[900]];
  const accent: Ramp =
    business.brandColor && isHex(business.brandColor)
      ? buildAccentRamp(business.brandColor, preset.mode, surfaces)
      : typeof preset.accent === 'string'
        ? buildAccentRamp(preset.accent, preset.mode, surfaces)
        : preset.accent;

  // Texto sobre el color principal: blanco u oscuro, el que se lea mejor
  const darkText = preset.mode === 'dark' ? preset.surface[950] : '#0C1B29';
  const onAccent = contrast(accent[500], '#FFFFFF') >= contrast(accent[500], darkText) ? '#FFFFFF' : darkText;

  const vars: Record<string, string> = {
    '--ink': triplet(preset.ink),
    '--scrim': preset.mode === 'dark' ? '0 0 0' : triplet(preset.ink),
    '--on-accent': triplet(onAccent),
    '--font-display': preset.fonts.display,
    '--font-body': preset.fonts.body,
    '--h-weight': String(preset.headingWeight),
    '--h-leading': String(preset.headingLeading),
    '--r-lg': preset.radius.lg,
    '--r-xl': preset.radius.xl,
    '--r-2xl': preset.radius['2xl'],
    '--r-3xl': preset.radius['3xl'],
    // Botones y selecciones: sombra dura (barbería) o suave del color principal (los demás)
    '--sticker-border': preset.hard ? '2px solid rgb(var(--slate-950))' : '0',
    '--sticker-shadow': preset.hard ? '4px 4px 0 0 rgb(var(--slate-100))' : '0 12px 26px -10px rgb(var(--accent-500) / 0.55)',
    '--sticker-shadow-down': preset.hard ? '1px 1px 0 0 rgb(var(--slate-100))' : '0 4px 10px -6px rgb(var(--accent-500) / 0.55)',
    '--sticker-press': preset.hard ? 'translate(3px, 3px)' : 'translateY(2px)',
    '--pop-accent': preset.hard ? '4px 4px 0 0 rgb(var(--accent-500))' : '0 10px 24px -12px rgb(var(--accent-500) / 0.6)',
    '--pop-ink': preset.hard ? '4px 4px 0 0 rgb(var(--slate-100))' : '0 10px 24px -12px rgb(var(--accent-500) / 0.6)',
    '--ticker-bg': preset.ticker.bg,
    '--ticker-fg': preset.ticker.fg,
    '--ticker-border': preset.ticker.border,
    '--ticker-style': preset.ticker.style,
    '--ticker-size': preset.ticker.size,
    '--ticker-tracking': preset.ticker.tracking,
    '--pole-bg': preset.pole,
    '--grain': String(preset.grain),
    '--stamp': preset.stamp,
    '--art-1': preset.art[0],
    '--art-2': preset.art[1],
    '--art-3': preset.art[2],
    '--focus': triplet(preset.mode === 'dark' ? accent[300] : accent[500]),
  };
  ([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const).forEach(step => {
    vars[`--slate-${step}`] = triplet(preset.surface[step]);
  });
  ([50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const).forEach(step => {
    vars[`--accent-${step}`] = triplet(accent[step]);
  });
  // El sello puede apuntar a un paso del color principal (así sigue al color de marca)
  if (preset.stamp.startsWith('var(')) vars['--stamp'] = vars[preset.stamp.slice(4, -1)];
  return { preset, vars };
};

const FONT_LINK_ID = 'theme-fonts';

export const applyTheme = (business: Pick<Business, 'theme' | 'category' | 'brandColor'>): ThemePreset => {
  const { preset, vars } = computeTheme(business);
  const root = document.documentElement;
  setVars(root, vars);
  root.dataset.theme = preset.key;
  root.dataset.mode = preset.mode;
  root.dataset.caps = preset.caps ? 'true' : 'false';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', preset.surface[950]);

  // Las letras del tema se piden una sola vez y solo si el tema las necesita
  let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (preset.fonts.href) {
    if (!link) {
      link = document.createElement('link');
      link.id = FONT_LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== preset.fonts.href) link.href = preset.fonts.href;
  } else if (link) {
    link.remove();
  }
  return preset;
};

// Dirección de una imagen del negocio: completa (https://...) o dentro de la app (demos/logo.svg)
export const assetUrl = (value: string): string => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return base + value.replace(/^\/+/, '');
};
