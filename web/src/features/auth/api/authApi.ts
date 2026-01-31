import { api } from '../../../shared/api/client';

export interface LoginResponse {
  token: string;
  user_id: string;
  username: string;
  is_admin: boolean;
}

function isLoginResponse(obj: unknown): obj is LoginResponse {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof (obj as LoginResponse).token === 'string' &&
    typeof (obj as LoginResponse).user_id === 'string' &&
    typeof (obj as LoginResponse).username === 'string' &&
    typeof (obj as LoginResponse).is_admin === 'boolean'
  );
}

export async function login(username: string): Promise<LoginResponse> {
  const res = await api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
  if (!isLoginResponse(res)) {
    throw new Error('Resposta de login inválida. Tente novamente.');
  }
  return res;
}
