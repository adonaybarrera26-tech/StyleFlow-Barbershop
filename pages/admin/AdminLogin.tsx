import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { loginAdmin } from '../../services/dataService';
import { isSupabaseEnabled } from '../../services/supabase';
import { useBusiness } from '../../services/BusinessContext';

const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
