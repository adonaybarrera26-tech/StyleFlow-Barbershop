import React, { createContext, useContext, useEffect } from 'react';

// La app está en español (México). Aquí viven los textos generales.
const translations: Record<string, string> = {
  bookNow: 'Reservar cita',
  adminPanel: 'Panel de administración',
  services: 'Nuestros servicios',
  aboutUs: 'Acerca de',
  contact: 'Contáctanos',
  footerText: 'Todos los derechos reservados.',
  signature: 'Sistema de citas en línea'
};

interface LanguageContextType {
  language: 'es';
  t: (key: string) => string;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'es-MX';
  }, []);

  const t = (key: string) => translations[key] || key;

  return (
    <LanguageContext.Provider value={{ language: 'es', t, isRtl: false }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage debe usarse dentro de LanguageProvider');
  return context;
};
