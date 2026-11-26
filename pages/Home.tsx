import React from 'react';
import { Link } from 'react-router-dom';
import { Scissors, MessageCircle, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../services/LanguageContext';
import { buildWhatsAppLink } from '../services/format';

const Home: React.FC = () => {
  const { t } = useLanguage();

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
        Reserva tu silla
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

      <Link
        to="/admin"
        className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"
      >
        <ShieldCheck size={16} />
        {t('adminPanel')}
      </Link>
    </div>
  );
};

export default Home;
