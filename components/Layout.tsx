import React from 'react';
import { Calendar, Lock, Home, Info } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../services/LanguageContext';

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
            ? 'bg-amber-600 text-white font-bold shadow-lg shadow-amber-900/20'
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
        <Icon size={24} strokeWidth={active ? 2.5 : 2} className={active ? "drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" : ""} />
        <span className="text-[10px] mt-1 font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row font-sans">

      {/* Barra superior (celular) */}
      <div className="md:hidden bg-slate-900 shadow-sm p-4 flex justify-center items-center sticky top-0 z-50 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white">
          <span>{t('heroTitle')}</span>
        </h1>
      </div>

      {/* Menú lateral (computadora) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 min-h-screen sticky top-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black text-white">
            <span>{t('heroTitle')}</span>
          </h1>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          <NavItem to="/" icon={Home} label="Inicio" />
          <NavItem to="/booking" icon={Calendar} label="Reservar cita" />
          <NavItem to="/about" icon={Info} label={t('aboutUs')} />
          <div className="pt-4 mt-4 border-t border-slate-800">
             <p className="px-4 text-xs text-slate-500 mb-2">Administración</p>
             <NavItem to="/admin" icon={Lock} label="Panel de administración" />
          </div>
        </nav>

        <div className="p-4">
          <div className="pt-4 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
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

      {/* Navegación inferior (celular) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-50 h-[70px] pb-safe">
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
