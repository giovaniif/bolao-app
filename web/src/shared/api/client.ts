import { expireSession, isExpired, needsRefresh, refreshOnce, SESSION_EXPIRED, type RefreshResult } from './session';

export const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

export function getToken(): string | null {
  return localStorage.getItem('token');
}

const PUBLIC_PATHS = ['/auth/login', '/auth/signup', '/auth/social', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password', '/auth/username-available'];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

async function requestRefresh(token: string): Promise<RefreshResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
  } catch {
    return { kind: 'offline' };
  }
  if (res.status === 401) return { kind: 'unauthorized' };
  if (!res.ok) return { kind: 'offline' };
  try {
    const data = JSON.parse(await res.text()) as { token?: unknown };
    return typeof data.token === 'string' ? { kind: 'ok', token: data.token } : { kind: 'offline' };
  } catch {
    return { kind: 'offline' };
  }
}

export function refreshSession(): Promise<RefreshResult> {
  const token = getToken();
  if (!token) return Promise.resolve({ kind: 'unauthorized' });
  return refreshOnce(() => requestRefresh(token));
}

function expiredError(): Error {
  return Object.assign(new Error(SESSION_EXPIRED), { status: 401 });
}

async function keepSessionFresh(token: string): Promise<void> {
  if (isExpired(token)) {
    await expireSession(token);
    throw expiredError();
  }
  if (needsRefresh(token)) {
    const result = await refreshSession();
    if (result.kind === 'unauthorized') {
      await expireSession(token);
      throw expiredError();
    }
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<T> {
  const guarded = !isPublic(path);
  const stored = getToken();
  if (guarded && stored) {
    await keepSessionFresh(stored);
  }
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error(
      err instanceof TypeError && err.message.includes('fetch')
        ? 'Não foi possível conectar à API. Verifique se o servidor está rodando.'
        : 'Erro de rede ao comunicar com o servidor'
    );
  }

  if (res.status === 401 && guarded && token) {
    if (!retried) {
      const result = await refreshSession();
      if (result.kind === 'ok') return api<T>(path, options, true);
      if (result.kind === 'offline') throw new Error('Erro de rede ao comunicar com o servidor');
    }
    await expireSession(token);
    throw expiredError();
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      res.ok
        ? 'Resposta inválida da API'
        : `Erro ${res.status}: ${text.slice(0, 100)}`
    );
  }

  if (!res.ok) {
    const errorMsg =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Erro ${res.status}`;
    const err = new Error(errorMsg) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = data;
    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (data === null || data === undefined) {
    throw new Error('A API retornou resposta vazia');
  }

  return data as T;
}
