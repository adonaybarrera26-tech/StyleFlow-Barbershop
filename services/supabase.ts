import { SUPABASE_CONFIG, USE_HASH_ROUTER } from '../constants';

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

// --- Contraseña del administrador ---

// Resultado de las operaciones de contraseña: ok, o un código que la pantalla traduce a un mensaje
export type AuthResult = { ok: true } | { ok: false; code: string };

export const getSessionEmail = (): string | null => readSession()?.email ?? null;

// Lee el código de error de Supabase Auth (error_code) de una respuesta que falló
const readAuthErrorCode = async (res: Response): Promise<string> => {
  try {
    const data = await res.json();
    return String(data.error_code || data.code || data.error || `http_${res.status}`);
  } catch (e) {
    return `http_${res.status}`;
  }
};

// Cambiar la contraseña con la sesión iniciada. Pide la contraseña actual (se verifica entrando de nuevo).
export const changePassword = async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
  const session = readSession();
  if (!session) return { ok: false, code: 'session_expired' };

  try {
    const check = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_CONFIG.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: session.email, password: currentPassword })
    });
    if (!check.ok) {
      const code = await readAuthErrorCode(check);
      return { ok: false, code: check.status === 400 || code === 'invalid_credentials' ? 'wrong_password' : code };
    }
    const fresh = sessionFromResponse(await check.json(), session.email);
    saveSession(fresh);

    const res = await fetch(`${baseUrl()}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: `Bearer ${fresh.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    });
    if (!res.ok) return { ok: false, code: await readAuthErrorCode(res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, code: 'network' };
  }
};

// "Olvidé mi contraseña": Supabase manda un correo con un enlace. Responde igual si el correo existe o no.
const SLUG_KEY = 'styleflow_recovery_slug';

export const requestPasswordReset = async (email: string, businessSlug: string): Promise<AuthResult> => {
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
  try {
    localStorage.setItem(SLUG_KEY, businessSlug); // para saber a qué negocio volver cuando abra el enlace
  } catch (e) {
    // sin almacenamiento: el enlace llevará a una pantalla general
  }
  try {
    const res = await fetch(`${baseUrl()}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_CONFIG.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) {
      const code = await readAuthErrorCode(res);
      return { ok: false, code: res.status === 429 ? 'rate_limited' : code };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, code: 'network' };
  }
};

// El enlace del correo regresa a la página con la sesión temporal en la dirección (después del #).
// Se guarda aparte, se borra de la dirección y se manda a la pantalla de "Nueva contraseña".
const RECOVERY_KEY = 'styleflow_recovery';
const FLASH_KEY = 'styleflow_flash';

export const captureAuthRedirect = (): void => {
  try {
    const raw = window.location.hash;
    if (!/^#(access_token|error)=/.test(raw)) return;
    const params = new URLSearchParams(raw.slice(1));

    let slug = '';
    try {
      slug = localStorage.getItem(SLUG_KEY) || '';
    } catch (e) {
      slug = '';
    }
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) slug = '';

    let target: string;
    const accessToken = params.get('access_token');
    if (params.get('type') === 'recovery' && accessToken) {
      sessionStorage.setItem(
        RECOVERY_KEY,
        JSON.stringify({
          accessToken,
          refreshToken: params.get('refresh_token') || '',
          expiresAt: Date.now() + (Number(params.get('expires_in')) || 3600) * 1000
        })
      );
      target = slug ? `/${slug}/admin/restablecer` : '/restablecer';
    } else {
      sessionStorage.setItem(FLASH_KEY, 'El enlace ya no sirve (vence pronto y solo se usa una vez). Pide uno nuevo.');
      target = slug ? `/${slug}/admin/login` : '/';
    }

    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    window.history.replaceState(null, '', USE_HASH_ROUTER ? `${window.location.pathname}#${target}` : `${base}${target}`);
  } catch (e) {
    // si algo falla, la app abre normal
  }
};

interface RecoverySession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const readRecovery = (): RecoverySession | null => {
  try {
    const raw = sessionStorage.getItem(RECOVERY_KEY);
    const data = raw ? (JSON.parse(raw) as RecoverySession) : null;
    return data && Date.now() < data.expiresAt ? data : null;
  } catch (e) {
    return null;
  }
};

export const hasRecoverySession = (): boolean => readRecovery() !== null;

// Mensaje que se muestra una sola vez en el acceso (por ejemplo, "el enlace venció")
export const takeFlashMessage = (): string => {
  try {
    const message = sessionStorage.getItem(FLASH_KEY) || '';
    sessionStorage.removeItem(FLASH_KEY);
    return message;
  } catch (e) {
    return '';
  }
};

// Guarda la nueva contraseña usando la sesión temporal del enlace; si sale bien, deja la sesión iniciada
export const setPasswordFromRecovery = async (newPassword: string): Promise<AuthResult> => {
  const recovery = readRecovery();
  if (!recovery) return { ok: false, code: 'link_expired' };

  try {
    const res = await fetch(`${baseUrl()}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: `Bearer ${recovery.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    });
    if (!res.ok) {
      const code = await readAuthErrorCode(res);
      if (res.status === 401 || code === 'bad_jwt' || code === 'session_not_found') {
        sessionStorage.removeItem(RECOVERY_KEY);
        return { ok: false, code: 'link_expired' };
      }
      return { ok: false, code };
    }
    const user = await res.json();
    sessionStorage.removeItem(RECOVERY_KEY);
    saveSession({
      accessToken: recovery.accessToken,
      refreshToken: recovery.refreshToken,
      expiresAt: recovery.expiresAt,
      email: user.email || ''
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, code: 'network' };
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

// ¿La persona que inició sesión es administradora de ESTE negocio?
export const checkIsAdmin = async (businessId: string): Promise<boolean> => {
  try {
    const result = await supabaseRequest<boolean>('/rest/v1/rpc/is_business_admin', {
      method: 'POST',
      body: { p_business: businessId },
      asAdmin: true
    });
    return result === true;
  } catch (e) {
    return false;
  }
};
