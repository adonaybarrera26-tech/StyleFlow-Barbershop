import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import PasswordInput from '../../components/PasswordInput';
import { Business } from '../../types';
import { checkIsAdmin, hasRecoverySession, setPasswordFromRecovery, signOut } from '../../services/supabase';
import { authErrorMessage, checkNewPassword, MIN_PASSWORD_LENGTH } from '../../services/authMessages';

// Pantalla a la que llega el enlace del correo "Olvidé mi contraseña": se escribe la contraseña nueva.
// Con business = null es la versión general (no se sabe de qué negocio viene el enlace).
const ResetPasswordForm: React.FC<{ business: Business | null; loginPath: string; panelPath: string }> = ({ business, loginPath, panelPath }) => {
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [linkOk, setLinkOk] = useState(hasRecoverySession());
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const problem = checkNewPassword(next, repeat);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    const result = await setPasswordFromRecovery(next);
    if (!result.ok) {
      setSaving(false);
      if (result.code === 'link_expired') setLinkOk(false);
      else setError(authErrorMessage(result.code));
      return;
    }

    // Contraseña guardada y sesión iniciada. Con negocio conocido se entra directo al panel.
    if (business) {
      if (await checkIsAdmin(business.id)) {
        navigate(panelPath, { replace: true });
        return;
      }
      await signOut();
      setSaving(false);
      setError('Tu contraseña cambió, pero este correo no administra este negocio.');
      return;
    }
    await signOut();
    setSaving(false);
    setFinished(true);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-800">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 shadow-inner">
            <KeyRound size={36} />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-white">Nueva contraseña</h2>
        {business && <p className="text-center text-slate-400 mt-2">{business.name}</p>}

        {finished ? (
          <p role="status" className="mt-6 text-center text-slate-300">
            Listo, tu contraseña cambió. Ya puedes entrar al panel de tu negocio con la contraseña nueva.
          </p>
        ) : !linkOk ? (
          <div className="mt-6 space-y-5 text-center">
            <p className="text-slate-300">{authErrorMessage('link_expired')}</p>
            {business && (
              <Link to={loginPath} className="inline-block bg-white text-slate-950 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                Ir al acceso
              </Link>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 mt-6">
            <PasswordInput label={`Contraseña nueva (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`} value={next} onChange={setNext} autoComplete="new-password" />
            <PasswordInput label="Repite la contraseña nueva" value={repeat} onChange={setRepeat} autoComplete="new-password" />
            {error && <p role="alert" className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-white text-slate-950 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors shadow-lg flex justify-center items-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 size={18} className="animate-spin" />}
              Guardar contraseña
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordForm;
