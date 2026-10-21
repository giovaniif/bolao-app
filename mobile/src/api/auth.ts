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

export async function forgotPassword(login: string): Promise<void> {
  await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ login }) });
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

export interface ProfileUpdate {
  username: string;
  display_name: string;
  favorite_team: string | null;
}

export function updateProfile(input: ProfileUpdate): Promise<Profile> {
  return api<Profile>('/me', { method: 'PUT', body: JSON.stringify(input) });
}

export function getTeams(): Promise<string[]> {
  return api<string[]>('/teams');
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
}
