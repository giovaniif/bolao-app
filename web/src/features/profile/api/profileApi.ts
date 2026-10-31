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
