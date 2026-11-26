import React from 'react';
import { MessageCircle, MapPin, CalendarCheck, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import { SHOP_INFO } from '../constants';
import { buildWhatsAppLink } from '../services/format';

const AboutProject: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-black text-white">{SHOP_INFO.name}</h1>
        <p className="text-amber-500 font-bold tracking-widest text-xs uppercase bg-amber-500/10 px-4 py-1 rounded-full inline-block">
          Sistema de citas en línea
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 space-y-6"
        >
          <div className="flex items-center gap-4 text-white">
            <CalendarCheck className="text-amber-500" />
            <h2 className="text-xl font-bold">¿Cómo funciona?</h2>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Tus clientes reservan desde el celular en tres pasos: eligen su servicio, su fecha y su hora. Tú ves y administras todas las citas desde el panel.
          </p>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-2">✓ Reservas en línea las 24 horas</li>
            <li className="flex items-center gap-2">✓ Panel para administrar citas y servicios</li>
            <li className="flex items-center gap-2">✓ Precios en pesos mexicanos</li>
            <li className="flex items-center gap-2">✓ Confirmación por WhatsApp</li>
            <li className="flex items-center gap-2">✓ Exporta tus citas a Excel o imprímelas</li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 space-y-6"
        >
          <div className="flex items-center gap-4 text-white">
            <MapPin className="text-amber-500" />
            <h2 className="text-xl font-bold">Ubicación y contacto</h2>
          </div>
          <div className="space-y-4 text-slate-300">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <span className="text-sm leading-relaxed">{SHOP_INFO.address}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={18} className="text-amber-500 shrink-0" />
              <span className="text-sm">{SHOP_INFO.displayPhone}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-3xl text-center space-y-6"
      >
        <h2 className="text-2xl font-bold text-white">¿Tienes dudas?</h2>
        <a
          href={buildWhatsAppLink('Hola, me gustaría tener más información sobre sus servicios.')}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors shadow-lg shadow-green-900/20"
        >
          <MessageCircle size={20} />
          Escríbenos por WhatsApp
        </a>
      </motion.div>

      <p className="text-center text-xs text-slate-600">
        Basado en{' '}
        <a href="https://github.com/erpycode/StyleFlow-Barbershop" target="_blank" rel="noreferrer" className="underline hover:text-slate-400">
          StyleFlow Barbershop
        </a>{' '}
        de ErPyCode · Licencia MIT
      </p>
    </div>
  );
};

export default AboutProject;
