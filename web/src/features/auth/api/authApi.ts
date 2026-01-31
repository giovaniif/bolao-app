import { api } from '../../../shared/api/client';

export interface LoginResponse {
  token: string;
  user_id: string;
  username: string;
  is_admin: boolean;
  must_change_password: boolean;
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

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!isLoginResponse(res)) {
    throw new Error('Resposta de login inválida. Tente novamente.');
  }
  return res;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ message: string; must_change_password: boolean }> {
  return api('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}
