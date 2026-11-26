import { SUPABASE_CONFIG } from '../constants';

// Cliente mínimo de Supabase hecho con fetch (sin instalar paquetes).

export const isSupabaseEnabled = (): boolean =>
  Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);

const baseUrl = (): string => SUPABASE_CONFIG.url.replace(/\/+$/, '');

// --- Sesión del administrador (se guarda en el navegador) ---

const SESSION_KEY = 'styleflow_auth';

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // milisegundos
  email: string;
}

const readSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch (e) {
    return null;
  }
};

const saveSession = (session: AuthSession): void => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const clearSession = (): void => {
  localStorage.removeItem(SESSION_KEY);
};

const sessionFromResponse = (data: any, fallbackEmail: string): AuthSession => ({
  accessToken: data.access_token,
  refreshToken: data.refresh_token,
  expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  email: (data.user && data.user.email) || fallbackEmail
});

let refreshing: Promise<string | null> | null = null;

const refreshSession = (session: AuthSession): Promise<string | null> => {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const res = await fetch(`${baseUrl()}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: SUPABASE_CONFIG.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken })
      });
      if (!res.ok) {
        clearSession();
        return null;
      }
      const next = sessionFromResponse(await res.json(), session.email);
      saveSession(next);
      return next.accessToken;
    } catch (e) {
      // Sin internet: no se borra la sesión, solo falla esta vez
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
};

// Regresa el token del administrador (renovándolo si ya casi vence) o null si no hay sesión
export const getAccessToken = async (): Promise<string | null> => {
  const session = readSession();
  if (!session) return null;
  if (Date.now() < session.expiresAt - 60000) return session.accessToken;
  return refreshSession(session);
};

export const signIn = async (email: string, password: string): Promise<boolean> => {
  const res = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_CONFIG.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) return false;
  saveSession(sessionFromResponse(await res.json(), email));
  return true;
};

export const signOut = async (): Promise<void> => {
  const session = readSession();
  clearSession();
  if (!session) return;
  try {
    await fetch(`${baseUrl()}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${session.accessToken}` }
    });
  } catch (e) {
    // Si falla, la sesión local ya se borró
  }
};

// --- Peticiones a la base de datos ---

export class SupabaseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SupabaseError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  asAdmin?: boolean; // true = con la sesión del administrador
  prefer?: string;
}

export const supabaseRequest = async <T = any>(path: string, options: RequestOptions = {}): Promise<T> => {
  const headers: Record<string, string> = {
    apikey: SUPABASE_CONFIG.anonKey,
    'Content-Type': 'application/json'
  };

  if (options.asAdmin) {
    const token = await getAccessToken();
    if (!token) throw new SupabaseError('session_expired', 401);
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.prefer) headers.Prefer = options.prefer;

  const res = await fetch(`${baseUrl()}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && options.asAdmin) {
      clearSession();
      throw new SupabaseError('session_expired', 401);
    }
    const message =
      (data && typeof data === 'object' && (data.message || data.msg || data.error_description || data.error)) ||
      `http_${res.status}`;
    throw new SupabaseError(String(message), res.status);
  }

  return data as T;
};

// ¿La persona que inició sesión está en la lista de administradores?
export const checkIsAdmin = async (): Promise<boolean> => {
  try {
    const result = await supabaseRequest<boolean>('/rest/v1/rpc/is_admin', {
      method: 'POST',
      body: {},
      asAdmin: true
    });
    return result === true;
  } catch (e) {
    return false;
  }
};
