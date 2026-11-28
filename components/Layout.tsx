import React from 'react';
import { Calendar, ClipboardList, Lock, Home, Info } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../services/LanguageContext';
import { useBusiness } from '../services/BusinessContext';
import { getCategory } from '../services/categories';
import { assetUrl } from '../services/themes';

const Ticker: React.FC = () => {
  const { business } = useBusiness();
  const { ticker, icon: CategoryIcon } = getCategory(business.category);
  // El contenido se repite varias veces para que el movimiento no tenga saltos
  const items = [...ticker, ...ticker, ...ticker, ...ticker];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {[0, 1].map(copy => (
          <React.Fragment key={copy}>
            {items.map((phrase, i) => (
              <React.Fragment key={`${copy}-${i}`}>
                <span className="ticker-item">{phrase}</span>
                <CategoryIcon size={14} strokeWidth={3} />
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
  const { business, path } = useBusiness();

  // Se ignora la diagonal final para que ".../barberia/" cuente como ".../barberia"
  const trimSlash = (value: string) => (value.length > 1 ? value.replace(/\/+$/, '') : value);
  const isCurrent = (to: string) => trimSlash(location.pathname) === trimSlash(to);

  // Logo del negocio (si lo tiene) junto a su nombre
  const Logo = ({ size }: { size: string }) =>
    business.logoUrl ? (
      <img src={assetUrl(business.logoUrl)} alt="" className={`brand-logo ${size} shrink-0 object-cover`} />
    ) : null;

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
    <div className="min-h-screen text-slate-200 flex flex-col font-sans">
      <Ticker />

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Barra superior (celular) */}
        <div className="glass-bar md:hidden bg-slate-900 p-4 flex justify-center items-center sticky top-0 z-50 border-b-2 border-slate-800">
          <h1 className="text-2xl text-white flex items-center gap-3">
            <Logo size="h-9 w-9" />
            <span>{business.name}</span>
          </h1>
        </div>

        {/* Menú lateral (computadora) */}
        <aside className="glass-bar hidden md:flex flex-col w-64 bg-slate-900 border-r-2 border-slate-800 sticky top-0 self-start min-h-screen">
          <div className="p-6 border-b-2 border-slate-800">
            <h1 className="text-3xl leading-none text-white flex items-center gap-3">
              <Logo size="h-11 w-11" />
              <span>{business.name}</span>
            </h1>
          </div>

          <nav className="p-4 space-y-2 flex-1">
            <NavItem to={path('/')} icon={Home} label="Inicio" />
            <NavItem to={path('/booking')} icon={Calendar} label="Reservar cita" />
            <NavItem to={path('/mis-reservas')} icon={ClipboardList} label="Mis reservas" />
            <NavItem to={path('/about')} icon={Info} label={t('aboutUs')} />
            <div className="pt-4 mt-4 border-t-2 border-slate-800">
               <p className="px-4 text-xs text-slate-500 mb-2">Administración</p>
               <NavItem to={path('/admin')} icon={Lock} label="Panel de administración" />
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
        <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Navegación inferior (celular) */}
      <nav className="glass-bar md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t-2 border-slate-800 z-50 h-[70px] pb-safe">
        <div className="flex justify-around items-center h-full px-2">
          <MobileNavItem to={path('/')} icon={Home} label="Inicio" />
          <MobileNavItem to={path('/booking')} icon={Calendar} label="Reservar" />
          <MobileNavItem to={path('/mis-reservas')} icon={ClipboardList} label="Mis reservas" />
          <MobileNavItem to={path('/about')} icon={Info} label="Info" />
          <MobileNavItem to={path('/admin')} icon={Lock} label="Admin" />
        </div>
      </nav>
    </div>
  );
};

export default Layout;
