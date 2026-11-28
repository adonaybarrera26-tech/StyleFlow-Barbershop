import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, MailCheck } from 'lucide-react';
import { loginAdmin } from '../../services/dataService';
import { isSupabaseEnabled, requestPasswordReset, takeFlashMessage } from '../../services/supabase';
import { authErrorMessage } from '../../services/authMessages';
import { useBusiness } from '../../services/BusinessContext';

const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => takeFlashMessage());
  const [loading, setLoading] = useState(false);
  // 'login' = entrar; 'forgot' = pedir el enlace; 'sent' = enlace pedido
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login');
  const navigate = useNavigate();
  const { business, path } = useBusiness();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await loginAdmin(business, username, password);
      if (success) {
        navigate(path('/admin/dashboard'));
      } else {
        setError(isSupabaseEnabled() ? 'Correo o contraseña incorrectos.' : 'Usuario o contraseña incorrectos.');
      }
    } catch (err) {
      setError('No pudimos conectarnos. Revisa tu internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const email = username.trim();
    if (!email) {
      setError('Escribe el correo con el que entras al panel.');
      return;
    }
    setLoading(true);
    const result = await requestPasswordReset(email, business.slug);
    setLoading(false);
    if (result.ok) setMode('sent');
    else setError(authErrorMessage(result.code));
  };

  const backToLogin = () => {
    setMode('login');
    setError('');
  };

  if (mode !== 'login') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-800">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 shadow-inner">
              {mode === 'sent' ? <MailCheck size={36} /> : <Lock size={36} />}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-white">{mode === 'sent' ? 'Revisa tu correo' : 'Recuperar contraseña'}</h2>
          <p className="text-center text-slate-400 mt-2 mb-8">{business.name}</p>

          {mode === 'sent' ? (
            <div className="space-y-5 text-center">
              <p className="text-slate-300">
                Si <span className="text-white">{username.trim()}</span> tiene acceso al panel, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.
              </p>
              <button type="button" onClick={backToLogin} className="w-full bg-white text-slate-950 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                Volver al acceso
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-5">
              <p className="text-slate-400 text-sm">Escribe tu correo y te mandamos un enlace para crear una contraseña nueva.</p>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Correo</label>
                <input
                  type="email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="none"
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              {error && <p role="alert" className="text-red-500 text-sm text-center bg-red-500/10 py-2 px-3 rounded-lg">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-slate-950 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors shadow-lg flex justify-center items-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                Enviar enlace
              </button>
              <button type="button" onClick={backToLogin} className="w-full text-slate-400 hover:text-white text-sm py-1">
                Volver al acceso
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-800">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 shadow-inner">
            <Lock size={36} />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-white">Acceso de administrador</h2>
        <p className="text-center text-slate-400 mt-2 mb-8">{business.name}</p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">{isSupabaseEnabled() ? 'Correo' : 'Usuario'}</label>
            <input
              type={isSupabaseEnabled() ? 'email' : 'text'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoComplete={isSupabaseEnabled() ? 'email' : 'username'}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Contraseña</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-slate-950 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors shadow-lg mt-2 flex justify-center items-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? 'Verificando...' : 'Entrar al panel'}
          </button>
          {isSupabaseEnabled() && (
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(''); }}
              className="w-full text-slate-400 hover:text-white text-sm py-1 underline underline-offset-2"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
