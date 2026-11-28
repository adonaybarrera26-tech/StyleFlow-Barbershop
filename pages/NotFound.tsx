import React from 'react';
import { Link } from 'react-router-dom';
import { PLATFORM } from '../constants';
import { useBusiness } from '../services/BusinessContext';

// Dirección que no existe (por ejemplo, un negocio mal escrito)
const NotFound: React.FC = () => (
  <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6 text-center">
    <div className="max-w-sm space-y-4">
      <h1 className="text-5xl text-white">No encontramos esta página</h1>
      <p className="text-slate-400">
        Revisa que el enlace esté completo o pídele al negocio que te lo mande de nuevo.
      </p>
      {PLATFORM.name && (
        <a href={PLATFORM.url} className="inline-block text-amber-500 underline">
          Ir a {PLATFORM.name}
        </a>
      )}
    </div>
  </div>
);

export default NotFound;

// Pantalla que no existe dentro de un negocio (ya con el menú del negocio)
export const BusinessNotFound: React.FC = () => {
  const { path } = useBusiness();
  return (
    <div className="py-16 text-center space-y-4">
      <h1 className="text-4xl text-white">No encontramos esta página</h1>
      <Link to={path('/')} className="inline-block text-amber-500 underline">
        Volver al inicio
      </Link>
    </div>
  );
};
