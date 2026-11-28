import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { Business, BusinessLocation } from '../types';
import { USE_HASH_ROUTER } from '../constants';

// El negocio que se está viendo (el que va en la dirección: .../<slug>) y una ayuda para armar sus rutas.
interface BusinessContextType {
  business: Business;
  // Locales activos del negocio, en orden. Vacío = el negocio es un solo lugar (sin selector de local).
  locations: BusinessLocation[];
  // Vuelve a leer los locales (el panel de administración lo usa después de guardar cambios)
  refreshLocations: () => Promise<void>;
  // Ruta de una pantalla dentro de este negocio: path('/booking') -> "/<slug>/booking"; path() -> "/<slug>"
  path: (to?: string) => string;
  // Dirección completa del negocio, para mandarla en mensajes (por ejemplo, al reagendar)
  url: string;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{
  business: Business;
  locations?: BusinessLocation[];
  refreshLocations?: () => Promise<void>;
  children: React.ReactNode;
}> = ({ business, locations = [], refreshLocations = async () => {}, children }) => {
  const slug = business.slug;

  const path = useCallback(
    (to: string = '/'): string => {
      if (to === '/' || to === '') return `/${slug}`;
      return `/${slug}${to.startsWith('/') ? to : `/${to}`}`;
    },
    [slug]
  );

  const url = useMemo(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    return USE_HASH_ROUTER
      ? `${window.location.origin}${base}/#/${slug}`
      : `${window.location.origin}${base}/${slug}`;
  }, [slug]);

  const value = useMemo(
    () => ({ business, locations, refreshLocations, path, url }),
    [business, locations, refreshLocations, path, url]
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
};

export const useBusiness = (): BusinessContextType => {
  const context = useContext(BusinessContext);
  if (!context) throw new Error('useBusiness debe usarse dentro de BusinessProvider');
  return context;
};
