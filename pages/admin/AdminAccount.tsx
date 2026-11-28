import React, { useState } from 'react';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import PasswordInput from '../../components/PasswordInput';
import { changePassword, getSessionEmail } from '../../services/supabase';
import { authErrorMessage, checkNewPassword, MIN_PASSWORD_LENGTH } from '../../services/authMessages';

// "Mi cuenta": cambiar la contraseña con la que se entra al panel
const AdminAccount: React.FC = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone(false);

    if (!current) {
      setError('Escribe tu contraseña actual.');
      return;
    }
    const problem = checkNewPassword(next, repeat);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    const result = await changePassword(current, next);
    setSaving(false);

    if (result.ok) {
      setCurrent('');
      setNext('');
      setRepeat('');
      setDone(true);
    } else {
      setError(authErrorMessage(result.code));
    }
  };

  const email = getSessionEmail();

  return (
    <div className="mt-6 bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-xl">
      <div className="flex items-center gap-3 mb-2 pb-4 border-b border-slate-800">
        <KeyRound className="text-amber-500" size={28} />
        <h2 className="text-2xl font-bold text-white">Mi cuenta</h2>
      </div>
      {email && <p className="text-slate-400 text-sm mb-6">Entras con <span className="text-slate-200">{email}</span></p>}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <h3 className="font-bold text-white text-lg">Cambiar contraseña</h3>
        <PasswordInput label="Contraseña actual" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordInput label={`Contraseña nueva (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`} value={next} onChange={setNext} autoComplete="new-password" />
        <PasswordInput label="Repite la contraseña nueva" value={repeat} onChange={setRepeat} autoComplete="new-password" />

        {error && <p role="alert" className="text-red-500 text-sm bg-red-500/10 py-2 px-3 rounded-lg">{error}</p>}
        {done && (
          <p role="status" className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 py-2 px-3 rounded-lg">
            <CheckCircle2 size={16} className="shrink-0" /> Listo, tu contraseña cambió. Úsala la próxima vez que entres.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-amber-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          Cambiar contraseña
        </button>
      </form>
    </div>
  );
};

export default AdminAccount;
