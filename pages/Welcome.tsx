import React from 'react';
import { PLATFORM } from '../constants';

// Portada general: se ve al abrir el sitio sin el nombre de un negocio
const Welcome: React.FC = () => (
  <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6 text-center">
    <div className="max-w-md space-y-5">
      <h1 className="text-5xl text-white">Citas en línea</h1>
      <p className="text-slate-300 leading-relaxed">
        Para reservar una cita, abre el enlace de tu negocio. Termina con el nombre del negocio, por ejemplo:{' '}
        <span className="text-amber-400">…/nombre-del-negocio</span>
      </p>
      {PLATFORM.name && (
        <a href={PLATFORM.url} className="inline-block text-amber-500 underline">
          Conoce {PLATFORM.name}
        </a>
      )}
    </div>
  </div>
);

export default Welcome;
