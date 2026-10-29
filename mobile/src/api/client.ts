export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'https://bolao-api-dev-1030775803263.us-central1.run.app/api').replace(/\/$/, '');

let currentToken: string | null = null;

export function setToken(token: string | null) {
  currentToken = token;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (currentToken) {
    headers.Authorization = `Bearer ${currentToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('Sem conexão com o servidor. Tente de novo.');
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
