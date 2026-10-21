import { api } from '../../../shared/api/client';

export async function getTeams(): Promise<string[]> {
  return api<string[]>('/teams');
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  favorite_team: string | null;
  is_admin: boolean;
  email?: string;
}

export async function getProfile(): Promise<Profile> {
  return api<Profile>('/me');
}

export async function updateProfile(data: {
  username: string;
  display_name: string;
  favorite_team?: string | null;
  email?: string;
}): Promise<Profile> {
  return api<Profile>('/me', {
    method: 'PUT',
    body: JSON.stringify({
      username: data.username,
      display_name: data.display_name,
      favorite_team: data.favorite_team ?? null,
      ...(data.email ? { email: data.email } : {}),
    }),
  });
}

export async function deleteAccount(): Promise<void> {
  await api('/me', { method: 'DELETE' });
}
