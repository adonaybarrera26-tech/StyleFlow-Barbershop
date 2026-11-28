import React, { useState } from 'react';
import { assetUrl } from '../services/themes';

// Foto de un profesional. Sin foto (o si no carga) se muestran sus iniciales.
const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');

interface Props {
  name: string;
  photoUrl: string;
  className?: string; // tamaño y forma: por defecto un círculo de 64 px
}

const ProAvatar: React.FC<Props> = ({ name, photoUrl, className = 'w-16 h-16 rounded-full' }) => {
  const [failed, setFailed] = useState(false);
  const src = photoUrl && !failed ? assetUrl(photoUrl) : '';

  return src ? (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} object-cover bg-slate-800 shrink-0`}
    />
  ) : (
    <span
      aria-label={name}
      className={`${className} bg-slate-800 text-amber-500 font-display text-xl flex items-center justify-center shrink-0`}
    >
      {initials(name) || '?'}
    </span>
  );
};

export default ProAvatar;
