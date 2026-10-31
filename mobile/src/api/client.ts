import { expireSession, isExpired, needsRefresh, refreshOnce, SESSION_EXPIRED, type RefreshResult } from './session';

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'https://bolao-api-dev-1030775803263.us-central1.run.app/api').replace(/\/$/, '');

let currentToken: string | null = null;

export function setToken(token: string | null) {
  currentToken = token;
}

export function getToken(): string | null {
  return currentToken;
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
  const token = currentToken;
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

export async function api<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const guarded = !isPublic(path);
  if (guarded && currentToken) {
    await keepSessionFresh(currentToken);
  }
  const sentToken = currentToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (sentToken) {
    headers.Authorization = `Bearer ${sentToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('Sem conexão com o servidor. Tente de novo.');
  }

  if (res.status === 401 && guarded && sentToken) {
    if (!retried) {
      const result = await refreshSession();
      if (result.kind === 'ok') return api<T>(path, options, true);
      if (result.kind === 'offline') throw new Error('Sem conexão com o servidor. Tente de novo.');
    }
    await expireSession(sentToken);
    throw expiredError();
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(res.ok ? 'Resposta inválida do servidor' : `Erro ${res.status}`);
    }
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Erro ${res.status}`;
    throw Object.assign(new Error(message), { status: res.status, body: data });
  }
  return data as T;
}
