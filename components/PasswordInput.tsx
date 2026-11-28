import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Campo de contraseña con botón para ver lo que se escribe (ayuda mucho en el celular)
const PasswordInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
}> = ({ label, value, onChange, autoComplete }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-400 mb-2">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-3 text-slate-400 hover:text-white"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
};

export default PasswordInput;
