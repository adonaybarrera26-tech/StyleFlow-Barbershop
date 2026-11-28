import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ShieldCheck, Phone, MapPin, Instagram, Facebook, Clock, Calendar } from 'lucide-react';
import { useLanguage } from '../services/LanguageContext';
import { useBusiness } from '../services/BusinessContext';
import { getCategory } from '../services/categories';
import HeroArt from '../components/HeroArt';
import { buildWhatsAppLink, buildCallLink, buildMapsLink, formatMXN } from '../services/format';
import { getBusinessSettings } from '../services/dataService';
import { effectiveSchedule } from '../services/slots';
import { describeHours } from '../services/hours';
import { BusinessLocation, BusinessSettings } from '../types';

// lucide-react no trae el logo de TikTok, así que se dibuja aquí
const TikTokIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  external: boolean;
}

const Home: React.FC = () => {
  const { t } = useLanguage();
  const { business, path, locations } = useBusiness();
  const { icon: CategoryIcon, hero } = getCategory(business.category);
  const hasLocations = locations.length > 0;

  // Horario de cada sucursal (o del negocio): lo que la sucursal no define usa lo general
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  useEffect(() => {
    let cancelled = false;
    getBusinessSettings(business.id)
      .then(s => { if (!cancelled) setSettings(s); })
      .catch(() => { /* sin horario en el inicio; reservar sigue funcionando */ });
    return () => { cancelled = true; };
  }, [business.id]);

  const hoursOf = (location: BusinessLocation | null) =>
    settings ? describeHours(effectiveSchedule(location, settings)) : null;

  // La barra fija "Agendar cita" aparece cuando el botón grande de la portada ya salió de la pantalla
  const heroCta = useRef<HTMLAnchorElement>(null);
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    const el = heroCta.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setShowBar(!entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Botones de acción rápida. Los que el negocio no tiene capturados no se muestran.
  const quickActions: QuickAction[] = [
    { label: 'Llamar', href: buildCallLink(business), icon: <Phone size={24} />, external: false },
    // Con varias sucursales no hay un solo "Cómo llegar": cada sucursal lleva su propio mapa más abajo
    ...(locations.length > 1
      ? []
      : [{ label: 'Cómo llegar', href: buildMapsLink(locations[0] && locations[0].address ? locations[0] : business), icon: <MapPin size={24} />, external: true }]),
    { label: 'Instagram', href: business.instagramUrl, icon: <Instagram size={24} />, external: true },
    { label: 'Facebook', href: business.facebookUrl, icon: <Facebook size={24} />, external: true },
    { label: 'TikTok', href: business.tiktokUrl, icon: <TikTokIcon size={24} />, external: true },
  ].filter(action => action.href);

  return (
    <div className="flex flex-col items-center text-center pt-8 pb-28 md:py-12">
      {/* Ilustración de la portada: cada giro tiene la suya */}
      <HeroArt kind={hero} icon={CategoryIcon} category={business.category} logoUrl={business.logoUrl} />

      <h1 className="mt-14 text-6xl md:text-8xl leading-[var(--h-leading)] text-white max-w-2xl">
        {business.name}
      </h1>

      {/* Adorno de destello: solo lo muestran los temas que lo piden (spa y esencia) */}
      <div className="ornament" aria-hidden="true">
        <svg viewBox="-12 -12 24 24">
          <path d="M0 -11 Q2.2 -2.2 11 0 Q2.2 2.2 0 11 Q-2.2 2.2 -11 0 Q-2.2 -2.2 0 -11 Z" />
        </svg>
      </div>

      {business.tagline && (
        <p className="lead-text mt-6 text-lg md:text-xl text-slate-300 max-w-md leading-relaxed">
          {business.tagline}
        </p>
      )}

      <Link
        ref={heroCta}
        to={path('/booking')}
        className="sticker mt-10 inline-flex items-center justify-center bg-amber-500 text-black font-display uppercase tracking-wider text-2xl px-10 py-4 rounded-xl hover:bg-amber-400"
      >
        Reserva tu cita
      </Link>

      <a
        href={buildWhatsAppLink(business, 'Hola, me gustaría tener más información sobre sus servicios.')}
        target="_blank"
        rel="noreferrer"
        className="mt-8 inline-flex items-center gap-2 text-slate-300 font-semibold underline underline-offset-4 decoration-amber-500 decoration-2 hover:text-white"
      >
        <MessageCircle size={20} />
        ¿Dudas? Escríbenos por WhatsApp
      </a>

      {/* Llamar, mapa y redes sociales */}
      <nav aria-label="Contacto y redes sociales" className="mt-12 w-full max-w-md">
        <ul className="flex flex-wrap justify-center gap-3">
          {quickActions.map(action => (
            <li key={action.label}>
              <a
                href={action.href}
                target={action.external ? '_blank' : undefined}
                rel={action.external ? 'noreferrer' : undefined}
                className="flex h-20 w-24 flex-col items-center justify-center gap-2 rounded-lg border-2 border-slate-700 bg-slate-900 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-500 hover:text-white"
              >
                <span className="text-amber-500">{action.icon}</span>
                {action.label}
              </a>
            </li>
          ))}
        </ul>
        {locations.length > 1 ? (
          <ul className="mt-6 grid w-full max-w-md gap-2 text-left">
            {locations.map(l => (
              <li key={l.id}>
                <a
                  href={buildMapsLink(l.address || l.mapsUrl ? l : business)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3 transition-colors hover:border-amber-500"
                >
                  <MapPin size={16} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-white">{l.name}</span>
                    {l.address && <span className="block text-xs text-slate-400">{l.address}</span>}
                    {hoursOf(l) && (
                      <span className="mt-1 flex items-center gap-1 text-xs text-slate-300">
                        <Clock size={12} className="shrink-0 text-amber-500" aria-hidden="true" />
                        {hoursOf(l)!.line}
                      </span>
                    )}
                    {hoursOf(l)?.breakLine && <span className="block text-xs text-slate-500">{hoursOf(l)!.breakLine}</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 space-y-1 text-sm text-slate-400">
            <p className="inline-flex items-center justify-center gap-1.5">
              <MapPin size={14} aria-hidden="true" />
              {hasLocations && locations[0].address ? locations[0].address : business.address}
            </p>
            {hoursOf(locations[0] ?? null) && (
              <p className="flex items-center justify-center gap-1.5 text-slate-300">
                <Clock size={14} className="text-amber-500" aria-hidden="true" />
                {hoursOf(locations[0] ?? null)!.line}
              </p>
            )}
            {hoursOf(locations[0] ?? null)?.breakLine && (
              <p className="text-xs text-slate-500">{hoursOf(locations[0] ?? null)!.breakLine}</p>
            )}
          </div>
        )}
      </nav>

      {/* Detalles del servicio */}
      {business.perks.length > 0 && (
        <ul className="mt-8 flex max-w-md flex-wrap justify-center gap-2">
          {business.perks.map(perk => (
            <li
              key={perk}
              className="rounded-lg border border-amber-500/70 px-3 py-1 text-sm font-semibold text-amber-300"
            >
              {perk}
            </li>
          ))}
        </ul>
      )}

      {/* Promociones: se piden por WhatsApp */}
      {business.promotions.length > 0 && (
        <section className="mt-16 w-full max-w-lg" aria-labelledby="promociones-titulo">
          <h2 id="promociones-titulo" className="text-5xl text-white">
            Promociones
          </h2>
          <p className="mt-2 text-slate-400">Pide la tuya por WhatsApp.</p>

          <ul className="mt-6 space-y-4 text-left">
            {business.promotions.map(promo => (
              <li key={promo.id} className="rounded-lg border-2 border-slate-700 bg-slate-900 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-2xl uppercase tracking-wide text-white">{promo.title}</h3>
                    <p className="mt-1 text-slate-300">{promo.description}</p>
                    {promo.days && <p className="mt-2 text-sm font-semibold text-amber-400">{promo.days}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-slate-500 line-through">{formatMXN(promo.normalPrice)}</p>
                    <p className="font-display text-3xl text-amber-400">{formatMXN(promo.promoPrice)}</p>
                  </div>
                </div>
                <a
                  href={buildWhatsAppLink(
                    business,
                    `Hola, quiero la promoción "${promo.title}" (${formatMXN(promo.promoPrice)}). ¿Qué horarios tienen?`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-amber-500 px-4 py-2 font-semibold text-amber-400 transition-colors hover:bg-amber-500 hover:text-black"
                >
                  <MessageCircle size={18} aria-hidden="true" />
                  Pedir esta promo
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Barra fija (solo celular): arriba de la navegación de abajo */}
      {showBar && (
        <div className="fixed bottom-[70px] left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 p-3 backdrop-blur md:hidden">
          <Link
            to={path('/booking')}
            className="sticker mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-display text-xl uppercase tracking-wider text-black hover:bg-amber-400"
          >
            <Calendar size={20} aria-hidden="true" />
            Agendar cita
          </Link>
        </div>
      )}

      <Link
        to={path('/admin')}
        className="mt-16 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"
      >
        <ShieldCheck size={16} />
        {t('adminPanel')}
      </Link>
    </div>
  );
};

export default Home;
