const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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
    throw new Error(errorMsg);
  }

  if (data === null || data === undefined) {
    throw new Error('A API retornou resposta vazia');
  }

  return data as T;
}
