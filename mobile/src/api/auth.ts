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
