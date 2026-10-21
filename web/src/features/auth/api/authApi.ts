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

export type SocialProvider = 'apple' | 'google';

export async function socialLogin(provider: SocialProvider, idToken: string, username?: string): Promise<LoginResponse> {
  const body: Record<string, string> = { provider, id_token: idToken };
  if (username) body.username = username;
  const res = await api<LoginResponse>('/auth/social', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!isLoginResponse(res)) {
    throw new Error('Resposta de login inválida. Tente novamente.');
  }
  return res;
}

export function needsUsername(err: unknown): boolean {
  if (!(err instanceof Error) || !('body' in err)) return false;
  const body = (err as { body: unknown }).body;
  return body !== null && typeof body === 'object' && (body as { needs_username?: unknown }).needs_username === true;
}

export interface SignupInput {
  username: string;
  display_name: string;
  email: string;
  password: string;
}

export async function signup(input: SignupInput): Promise<LoginResponse> {
  const res = await api<LoginResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!isLoginResponse(res)) {
    throw new Error('Resposta de cadastro inválida. Tente novamente.');
  }
  return res;
}

export async function forgotPassword(login: string): Promise<void> {
  await api('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ login }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}
