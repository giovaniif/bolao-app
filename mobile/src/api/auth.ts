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

export type SocialProvider = 'apple' | 'google';

export function socialLogin(provider: SocialProvider, idToken: string, username?: string, name?: string): Promise<LoginResponse> {
  const body: Record<string, string> = { provider, id_token: idToken };
  if (username) body.username = username;
  if (name) body.name = name;
  return api<LoginResponse>('/auth/social', { method: 'POST', body: JSON.stringify(body) });
}

export function needsUsername(err: unknown): boolean {
  if (!(err instanceof Error) || !('body' in err)) return false;
  const body = (err as { body: unknown }).body;
  return body !== null && typeof body === 'object' && (body as { needs_username?: unknown }).needs_username === true;
}

export function suggestedUsername(err: unknown): string {
  if (!(err instanceof Error) || !('body' in err)) return '';
  const body = (err as { body: unknown }).body;
  const value = body !== null && typeof body === 'object' ? (body as { suggested_username?: unknown }).suggested_username : undefined;
  return typeof value === 'string' ? value : '';
}

export interface UsernameAvailability {
  valid: boolean;
  available: boolean;
}

export function usernameAvailable(username: string): Promise<UsernameAvailability> {
  return api<UsernameAvailability>(`/auth/username-available?username=${encodeURIComponent(username)}`);
}

export interface DeletionCandidate {
  user_id: string;
  display_name: string;
  role: string;
}

export interface DeletionBlocker {
  bolao_id: string;
  bolao_name: string;
  suggested_owner_id: string;
  members: DeletionCandidate[];
}

export async function getDeletionBlockers(): Promise<DeletionBlocker[]> {
  const res = await api<{ blockers: DeletionBlocker[] }>('/me/deletion-check');
  return res.blockers;
}

export async function deleteAccount(newOwners: Record<string, string> = {}): Promise<void> {
  if (Object.keys(newOwners).length === 0) {
    await api('/me', { method: 'DELETE' });
    return;
  }
  await api('/me', { method: 'DELETE', body: JSON.stringify({ new_owners: newOwners }) });
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
