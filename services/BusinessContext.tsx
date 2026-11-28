import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { Business } from '../types';
import { USE_HASH_ROUTER } from '../constants';

// El negocio que se está viendo (el que va en la dirección: .../<slug>) y una ayuda para armar sus rutas.
interface BusinessContextType {
  business: Business;
  // Ruta de una pantalla dentro de este negocio: path('/booking') -> "/<slug>/booking"; path() -> "/<slug>"
  path: (to?: string) => string;
  // Dirección completa del negocio, para mandarla en mensajes (por ejemplo, al reagendar)
  url: string;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ business: Business; children: React.ReactNode }> = ({ business, children }) => {
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

  const value = useMemo(() => ({ business, path, url }), [business, path, url]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
};

export const useBusiness = (): BusinessContextType => {
  const context = useContext(BusinessContext);
  if (!context) throw new Error('useBusiness debe usarse dentro de BusinessProvider');
  return context;
};
