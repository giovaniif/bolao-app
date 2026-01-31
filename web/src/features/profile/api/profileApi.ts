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
  amount_paid: number;
}

export async function getProfile(): Promise<Profile> {
  return api<Profile>('/me');
}

export async function updateProfile(data: {
  username: string;
  display_name: string;
  favorite_team?: string | null;
}): Promise<Profile> {
  return api<Profile>('/me', {
    method: 'PUT',
    body: JSON.stringify({
      username: data.username,
      display_name: data.display_name,
      favorite_team: data.favorite_team ?? null,
    }),
  });
}
