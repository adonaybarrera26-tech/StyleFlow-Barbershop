import React from 'react';
import { Calendar, Lock, Home, Info, Scissors } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../services/LanguageContext';

// Frases de la cinta superior
const TICKER_PHRASES = ['Corte fresco', 'Flow real', 'Reserva tu cita', 'Barba al punto'];

const Ticker: React.FC = () => {
  // El contenido se repite dos veces para que el movimiento no tenga saltos
  const items = [...TICKER_PHRASES, ...TICKER_PHRASES, ...TICKER_PHRASES, ...TICKER_PHRASES];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {[0, 1].map(copy => (
          <React.Fragment key={copy}>
            {items.map((phrase, i) => (
              <React.Fragment key={`${copy}-${i}`}>
                <span className="ticker-item">{phrase}</span>
                <Scissors size={14} strokeWidth={3} />
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { t } = useLanguage();

  const isCurrent = (path: string) => location.pathname === path;

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const active = isCurrent(to);
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
          active
            ? 'bg-amber-500 text-black font-bold'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`}
      >
        <Icon size={20} />
        <span>{label}</span>
      </Link>
    );
  };

  const MobileNavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const active = isCurrent(to);
    return (
      <Link
        to={to}
        className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
          active
            ? 'text-amber-500'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <Icon size={24} strokeWidth={active ? 2.5 : 2} />
        <span className="text-[11px] mt-1 font-semibold">{label}</span>
        {active && <span className="block w-6 h-1 bg-amber-500 mt-1"></span>}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
      <Ticker />

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Barra superior (celular) */}
        <div className="md:hidden bg-slate-900 p-4 flex justify-center items-center sticky top-0 z-50 border-b-2 border-slate-800">
          <h1 className="text-2xl text-white">
            <span>{t('heroTitle')}</span>
          </h1>
        </div>

        {/* Menú lateral (computadora) */}
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r-2 border-slate-800 sticky top-0 self-start min-h-screen">
          <div className="p-6 border-b-2 border-slate-800">
            <h1 className="text-3xl leading-none text-white">
              <span>{t('heroTitle')}</span>
            </h1>
          </div>

          <nav className="p-4 space-y-2 flex-1">
            <NavItem to="/" icon={Home} label="Inicio" />
            <NavItem to="/booking" icon={Calendar} label="Reservar cita" />
            <NavItem to="/about" icon={Info} label={t('aboutUs')} />
            <div className="pt-4 mt-4 border-t-2 border-slate-800">
               <p className="px-4 text-xs text-slate-500 mb-2">Administración</p>
               <NavItem to="/admin" icon={Lock} label="Panel de administración" />
            </div>
          </nav>

          <div className="p-4">
            <div className="pt-4 border-t-2 border-slate-800 text-center">
              <p className="text-xs text-slate-500">
                {t('signature')}
              </p>
            </div>
          </div>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-950 pb-24 md:pb-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Navegación inferior (celular) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t-2 border-slate-800 z-50 h-[70px] pb-safe">
        <div className="flex justify-around items-center h-full px-2">
          <MobileNavItem to="/" icon={Home} label="Inicio" />
          <MobileNavItem to="/booking" icon={Calendar} label="Reservar" />
          <MobileNavItem to="/about" icon={Info} label="Info" />
          <MobileNavItem to="/admin" icon={Lock} label="Admin" />
        </div>
      </nav>
    </div>
  );
};

export default Layout;
