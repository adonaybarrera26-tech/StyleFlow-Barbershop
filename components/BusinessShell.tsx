import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Business, BusinessLocation } from '../types';
import { getBusiness, getLocations } from '../services/dataService';
import { BusinessProvider } from '../services/BusinessContext';
import { applyTheme, DEFAULT_LOOK } from '../services/themes';
import Layout from './Layout';
import NotFound from '../pages/NotFound';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; business: Business; locations: BusinessLocation[] }
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
      .then(async business => {
        if (!business) return null;
        // Si no se pueden leer las sucursales, el negocio se muestra como un solo lugar
        const all = await getLocations(business.id).catch(() => [] as BusinessLocation[]);
        return { business, locations: all.filter(l => l.active) };
      })
      .then(result => {
        if (!cancelled) setState(result ? { status: 'ready', ...result } : { status: 'notfound' });
      })
      .catch(error => {
        console.error('No se pudo cargar el negocio', error);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  // Vuelve a leer las sucursales sin recargar la página (después de que el dueño las edita en el panel)
  const businessId = state.status === 'ready' ? state.business.id : null;
  const refreshLocations = useCallback(async () => {
    if (!businessId) return;
    const all = await getLocations(businessId).catch(() => null);
    if (!all) return;
    setState(prev =>
      prev.status === 'ready' && prev.business.id === businessId
        ? { ...prev, locations: all.filter(l => l.active) }
        : prev
    );
  }, [businessId]);

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
    <BusinessProvider business={state.business} locations={state.locations} refreshLocations={refreshLocations} key={state.business.id}>
      <Layout>
        <Outlet />
      </Layout>
    </BusinessProvider>
  );
};

export default BusinessShell;
