import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { HeroArt as HeroArtKind } from '../services/themes';
import { assetUrl } from '../services/themes';

// Ilustración de la portada. Cada giro tiene la suya; los colores salen del tema del negocio
// (variables --art-1/2/3 y --accent-*), así que cambian solos con el color de su marca.
// Tamaño: 15 rem (240 px), igual que el disco de la barbería, para que la portada no se mueva.

interface Props {
  kind: HeroArtKind;
  icon: LucideIcon; // ícono del giro
  category: string;
  logoUrl?: string; // logo del negocio (lo usa la portada "logo")
}

const fill = (variable: string): React.CSSProperties => ({ fill: variable });
const stroke = (variable: string): React.CSSProperties => ({ stroke: variable });

// Estrella de cuatro puntas (brillito)
const SPARKLE = 'M0 -11 Q2.2 -2.2 11 0 Q2.2 2.2 0 11 Q-2.2 2.2 -11 0 Q-2.2 -2.2 0 -11 Z';

// ---------- Barbería: disco de vinilo ----------
const Vinyl: React.FC<{ icon: LucideIcon }> = ({ icon: Icon }) => (
  <div className="vinyl">
    <div className="vinyl-label">
      <Icon size={34} strokeWidth={2.5} style={{ color: 'rgb(var(--on-accent))', transform: 'translateY(-14px)' }} />
    </div>
  </div>
);

// ---------- Spa y consultorios: ondas de agua con flor de loto o el ícono del giro ----------
const Ripple: React.FC<{ icon: LucideIcon; lotus: boolean }> = ({ icon: Icon, lotus }) => (
  <div className="hero-art relative">
    <svg viewBox="0 0 200 200">
      <defs>
        <radialGradient id="ripple-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: 'rgb(var(--accent-500))', stopOpacity: 0.34 }} />
          <stop offset="100%" style={{ stopColor: 'rgb(var(--accent-500))', stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient id="ripple-core" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'rgb(var(--accent-400))' }} />
          <stop offset="100%" style={{ stopColor: 'rgb(var(--accent-700))' }} />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill="url(#ripple-glow)" />
      <circle className="ripple-ring" cx="100" cy="100" r="94" fill="none" strokeWidth="1.2" style={{ ...stroke('rgb(var(--accent-500) / 0.34)') }} />
      <circle className="ripple-ring" cx="100" cy="100" r="76" fill="none" strokeWidth="1.6" style={{ ...stroke('rgb(var(--accent-500) / 0.5)') }} />
      <circle className="ripple-ring" cx="100" cy="100" r="58" fill="none" strokeWidth="2" style={{ ...stroke('rgb(var(--accent-400) / 0.7)') }} />
      <circle className="ripple-ring" cx="100" cy="100" r="42" style={{ fill: 'rgb(var(--accent-500) / 0.16)', stroke: 'rgb(var(--accent-300) / 0.7)', strokeWidth: 2 }} />
      <circle cx="100" cy="100" r="34" fill="url(#ripple-core)" />
      {lotus && (
        <g transform="translate(68 71)" style={fill('rgb(var(--ink))')}>
          <path d="M32 6 C41 17 41 33 32 46 C23 33 23 17 32 6 Z" />
          <path d="M31 47 C19 45 9 37 7 25 C19 25 28 33 31 47 Z" opacity="0.88" />
          <path d="M33 47 C45 45 55 37 57 25 C45 25 36 33 33 47 Z" opacity="0.88" />
          <path d="M30 48 C17 52 7 48 1 40 C11 35 24 38 30 48 Z" opacity="0.72" />
          <path d="M34 48 C47 52 57 48 63 40 C53 35 40 38 34 48 Z" opacity="0.72" />
        </g>
      )}
    </svg>
    {!lotus && (
      <span className="absolute inset-0 flex items-center justify-center" style={{ color: 'rgb(var(--on-accent))' }}>
        <Icon size={38} strokeWidth={2} />
      </span>
    )}
  </div>
);

// ---------- Dentista: muela brillante con destellos ----------
const Tooth: React.FC = () => (
  <div className="hero-art">
    <svg viewBox="0 0 200 200">
      <defs>
        <linearGradient id="tooth-body" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#FFFFFF' }} />
          <stop offset="100%" style={{ stopColor: 'rgb(var(--accent-100))' }} />
        </linearGradient>
      </defs>
      <circle cx="100" cy="102" r="92" style={fill('rgb(var(--accent-500) / 0.14)')} />
      <circle cx="100" cy="102" r="70" style={fill('rgb(var(--accent-500) / 0.14)')} />
      <ellipse cx="100" cy="176" rx="46" ry="6" style={fill('rgb(var(--accent-500) / 0.34)')} />
      <g transform="translate(40 30) scale(1.2)">
        <path
          d="M50 9 C40 3 22 5 19 26 C17 41 26 51 28 68 C29 80 33 95 40 95 C47 95 47 75 50 75 C53 75 53 95 60 95 C67 95 71 80 72 68 C74 51 83 41 81 26 C78 5 60 3 50 9 Z"
          fill="url(#tooth-body)"
          strokeWidth="4.5"
          strokeLinejoin="round"
          style={stroke('rgb(var(--accent-500))')}
        />
        <path d="M30 24 C31 16 37 12 43 12" fill="none" strokeWidth="4" strokeLinecap="round" style={stroke('rgb(var(--accent-100))')} />
      </g>
      {/* El brillito se mueve con CSS, por eso la posición va en un <g> aparte */}
      <g transform="translate(30 56) scale(1.3)"><path className="twinkle" d={SPARKLE} style={fill('rgb(var(--accent-500))')} /></g>
      <g transform="translate(168 78) scale(1.7)"><path className="twinkle" d={SPARKLE} style={{ ...fill('rgb(var(--accent-400))'), animationDelay: '-1.1s' }} /></g>
      <g transform="translate(158 28) scale(0.9)"><path className="twinkle" d={SPARKLE} style={{ ...fill('rgb(var(--accent-500))'), animationDelay: '-2.2s' }} /></g>
    </svg>
  </div>
);

// ---------- Nutriólogo: plato dividido en tres grupos de alimentos, con cubiertos ----------
const Plate: React.FC = () => (
  <div className="hero-art">
    <svg viewBox="0 0 200 200">
      <ellipse cx="100" cy="186" rx="64" ry="6" style={fill('rgb(var(--slate-50) / 0.12)')} />
      {/* cubiertos */}
      <g style={fill('rgb(var(--slate-500))')}>
        <rect x="3" y="108" width="7" height="62" rx="3.5" />
        <rect x="-1" y="36" width="3.4" height="48" rx="1.7" />
        <rect x="5.8" y="36" width="3.4" height="48" rx="1.7" />
        <rect x="12.6" y="36" width="3.4" height="48" rx="1.7" />
        <path d="M-1 76 H16 C16 96 11 104 6.5 104 C2 104 -1 96 -1 76 Z" />
        <rect x="190" y="104" width="7" height="66" rx="3.5" />
        <path d="M192 34 C203 44 203 84 192 102 Z" />
      </g>
      {/* plato */}
      <circle cx="100" cy="100" r="86" style={{ fill: 'rgb(var(--slate-900))', stroke: 'rgb(var(--slate-700))', strokeWidth: 2 }} />
      <circle cx="100" cy="100" r="70" style={{ fill: 'rgb(var(--slate-950))' }} />
      <g strokeWidth="3" strokeLinejoin="round" style={stroke('rgb(var(--slate-900))')}>
        <path d="M100 100 L100 36 A64 64 0 0 1 155.4 132 Z" style={{ ...fill('var(--art-1)'), ...stroke('rgb(var(--slate-900))') }} />
        <path d="M100 100 L155.4 132 A64 64 0 0 1 44.6 132 Z" style={{ ...fill('var(--art-2)'), ...stroke('rgb(var(--slate-900))') }} />
        <path d="M100 100 L44.6 132 A64 64 0 0 1 100 36 Z" style={{ ...fill('var(--art-3)'), ...stroke('rgb(var(--slate-900))') }} />
      </g>
      {/* verduras: chícharos */}
      <g fill="#FFFFFF" opacity="0.42">
        <circle cx="116" cy="62" r="4.6" /><circle cx="128" cy="76" r="4.6" /><circle cx="114" cy="82" r="4.6" /><circle cx="134" cy="94" r="4.6" />
      </g>
      {/* cereales: granos */}
      <g stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.5">
        <path d="M100 148 q6 -9 0 -18" fill="none" /><path d="M118 142 q4 -10 -4 -17" fill="none" /><path d="M82 142 q-4 -10 4 -17" fill="none" />
      </g>
      {/* leguminosas y proteína: frijoles */}
      <g fill="#FFFFFF" opacity="0.4">
        <ellipse cx="74" cy="80" rx="5.6" ry="3.6" transform="rotate(-30 74 80)" /><ellipse cx="64" cy="98" rx="5.6" ry="3.6" transform="rotate(20 64 98)" /><ellipse cx="82" cy="102" rx="5.6" ry="3.6" transform="rotate(-10 82 102)" />
      </g>
      <circle cx="100" cy="100" r="7" style={{ fill: 'rgb(var(--slate-900))' }} />
    </svg>
  </div>
);

// ---------- Estudios: el logo del negocio como protagonista, con halo y estrellas ----------
const LogoArt: React.FC<{ src: string }> = ({ src }) => (
  <div className="logo-art">
    <svg className="logo-art-stars" viewBox="0 0 200 200" aria-hidden="true">
      <g style={fill('rgb(var(--accent-300))')}>
        <g transform="translate(14 36) scale(1.1)"><path className="twinkle" d={SPARKLE} /></g>
        <g transform="translate(190 24) scale(0.8)"><path className="twinkle" d={SPARKLE} style={{ animationDelay: '-1.1s' }} /></g>
        <g transform="translate(184 176) scale(1.3)"><path className="twinkle" d={SPARKLE} style={{ animationDelay: '-2.2s' }} /></g>
        <g transform="translate(10 168) scale(0.7)"><path className="twinkle" d={SPARKLE} style={{ animationDelay: '-0.6s' }} /></g>
      </g>
    </svg>
    <img src={src} alt="" width="240" height="240" />
  </div>
);

const HeroArt: React.FC<Props> = ({ kind, icon, category, logoUrl }) => (
  <div aria-hidden="true" className="flex items-center justify-center">
    {kind === 'vinyl' && <Vinyl icon={icon} />}
    {kind === 'logo' && logoUrl && <LogoArt src={assetUrl(logoUrl)} />}
    {kind === 'logo' && !logoUrl && <Ripple icon={icon} lotus={false} />}
    {kind === 'ripple' && <Ripple icon={icon} lotus={category === 'spa'} />}
    {kind === 'tooth' && <Tooth />}
    {kind === 'plate' && <Plate />}
  </div>
);

export default HeroArt;
