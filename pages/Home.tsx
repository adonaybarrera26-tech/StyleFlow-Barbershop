import React from 'react';
import { Link } from 'react-router-dom';
import { Scissors, MessageCircle, ShieldCheck, Phone, MapPin, Instagram, Facebook } from 'lucide-react';
import { useLanguage } from '../services/LanguageContext';
import { buildWhatsAppLink, buildCallLink, buildMapsLink, formatMXN } from '../services/format';
import { SHOP_INFO, PROMOTIONS } from '../constants';

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

  // Botones de acción rápida. Los que no tienen link en constants.ts no se muestran.
  const quickActions: QuickAction[] = [
    { label: 'Llamar', href: buildCallLink(), icon: <Phone size={24} />, external: false },
    { label: 'Cómo llegar', href: buildMapsLink(), icon: <MapPin size={24} />, external: true },
    { label: 'Instagram', href: SHOP_INFO.instagramUrl, icon: <Instagram size={24} />, external: true },
    { label: 'Facebook', href: SHOP_INFO.facebookUrl, icon: <Facebook size={24} />, external: true },
    { label: 'TikTok', href: SHOP_INFO.tiktokUrl, icon: <TikTokIcon size={24} />, external: true },
  ].filter(action => action.href);

  return (
    <div className="flex flex-col items-center text-center py-8 md:py-12">
      {/* Disco de vinilo con tijeras en la etiqueta */}
      <div className="vinyl" aria-hidden="true">
        <div className="vinyl-label">
          <Scissors size={34} strokeWidth={2.5} color="#0B0A08" style={{ transform: 'translateY(-14px)' }} />
        </div>
      </div>

      <h1 className="mt-14 text-6xl md:text-8xl leading-[0.95] text-white max-w-2xl">
        {t('heroTitle')}
      </h1>

      <p className="mt-6 text-lg md:text-xl text-slate-300 max-w-md leading-relaxed">
        {t('heroSubtitle')}
      </p>

      <Link
        to="/booking"
        className="sticker mt-10 inline-flex items-center justify-center bg-amber-500 text-black font-display uppercase tracking-wider text-2xl px-10 py-4 rounded-xl hover:bg-amber-400"
      >
        Reserva tu cita
      </Link>

      <a
        href={buildWhatsAppLink('Hola, me gustaría tener más información sobre sus servicios.')}
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
        <p className="mt-4 inline-flex items-center justify-center gap-1.5 text-sm text-slate-400">
          <MapPin size={14} aria-hidden="true" />
          {SHOP_INFO.address}
        </p>
      </nav>

      {/* Detalles del servicio */}
      {SHOP_INFO.perks.length > 0 && (
        <ul className="mt-8 flex max-w-md flex-wrap justify-center gap-2">
          {SHOP_INFO.perks.map(perk => (
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
      {PROMOTIONS.length > 0 && (
        <section className="mt-16 w-full max-w-lg" aria-labelledby="promociones-titulo">
          <h2 id="promociones-titulo" className="text-5xl text-white">
            Promociones
          </h2>
          <p className="mt-2 text-slate-400">Pide la tuya por WhatsApp.</p>

          <ul className="mt-6 space-y-4 text-left">
            {PROMOTIONS.map(promo => (
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

      <Link
        to="/admin"
        className="mt-16 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"
      >
        <ShieldCheck size={16} />
        {t('adminPanel')}
      </Link>
    </div>
  );
};

export default Home;
