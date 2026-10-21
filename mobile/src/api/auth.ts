import { api } from './client';

export interface LoginResponse {
  token: string;
  user_id: string;
  username: string;
  is_admin: boolean;
  must_change_password: boolean;
}

export interface SignupInput {
  username: string;
  display_name: string;
  email: string;
  password: string;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return api<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export function signup(input: SignupInput): Promise<LoginResponse> {
  return api<LoginResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(input) });
}

export async function deleteAccount(): Promise<void> {
  await api('/me', { method: 'DELETE' });
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  favorite_team?: string;
  is_admin: boolean;
}

export function getProfile(): Promise<Profile> {
  return api<Profile>('/me');
}
