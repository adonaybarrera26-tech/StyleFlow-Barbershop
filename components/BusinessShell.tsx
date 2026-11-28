import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Business } from '../types';
import { getBusiness } from '../services/dataService';
import { BusinessProvider } from '../services/BusinessContext';
import { applyTheme, DEFAULT_LOOK } from '../services/themes';
import Layout from './Layout';
import NotFound from '../pages/NotFound';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; business: Business }
  | { status: 'notfound' }
  | { status: 'error' };

// Carga el negocio de la dirección (.../<slug>) y le pone el menú; las pantallas van dentro (Outlet).
const BusinessShell: React.FC = () => {
  const { slug = '' } = useParams();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    getBusiness(slug.toLowerCase())
      .then(business => {
        if (!cancelled) setState(business ? { status: 'ready', business } : { status: 'notfound' });
      })
      .catch(error => {
        console.error('No se pudo cargar el negocio', error);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  // Colores, letra y formas del negocio según su giro; sin negocio (cargando o con error) se ve el look base
  useLayoutEffect(() => {
    applyTheme(state.status === 'ready' ? state.business : DEFAULT_LOOK);
  }, [state]);

  // Al salir de un negocio se regresa al look base
  useLayoutEffect(() => () => {
    applyTheme(DEFAULT_LOOK);
  }, []);

  // El título de la pestaña lleva el nombre del negocio
  useEffect(() => {
    if (state.status === 'ready') {
      document.title = `${state.business.name} | Reserva tu cita`;
    }
  }, [state]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400" role="status" aria-label="Cargando">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (state.status === 'notfound') return <NotFound />;

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="text-4xl text-white">No pudimos cargar la página</h1>
          <p className="text-slate-400">Revisa tu internet e intenta de nuevo.</p>
          <button
            onClick={() => setAttempt(n => n + 1)}
            className="bg-amber-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-amber-400"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <BusinessProvider business={state.business} key={state.business.id}>
      <Layout>
        <Outlet />
      </Layout>
    </BusinessProvider>
  );
};

export default BusinessShell;
