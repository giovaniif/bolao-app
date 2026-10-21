import { api } from './client';

export interface Competition {
  id: string;
  name: string;
}

export interface RuleBook {
  match: { key: string; points: number; text: string }[];
  round: { key: string; points: number; text: string }[];
  exact_score_variety_bonus: { score_types: number; points: number; text: string }[];
  notes: string[];
}

export interface InvitePreview {
  name: string;
  member_count: number;
  max_members: number;
  joins: 'direct' | 'request';
}

export interface Member {
  id: string;
  username: string;
  display_name: string;
  role: 'owner' | 'admin' | 'participant';
  status: 'active' | 'pending';
}

export const getCompetitions = () => api<Competition[]>('/competitions');
export const getRules = () => api<RuleBook>('/rules');

export async function createBolao(name: string, visibility: 'private' | 'public', requiresApproval: boolean, competitionId?: string) {
  const bolao = await api<{ id: string; name: string }>('/me/boloes', {
    method: 'POST',
    body: JSON.stringify(competitionId ? { name, competition_id: competitionId } : { name }),
  });
  await api(`/boloes/${bolao.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, visibility, requires_approval: requiresApproval }),
  });
  return bolao;
}

export const getInvitePreview = (code: string) => api<InvitePreview>(`/invites/${encodeURIComponent(code)}`);
export const joinInvite = (code: string) =>
  api<{ bolao_id: string; status: 'active' | 'pending' }>(`/invites/${encodeURIComponent(code)}/join`, { method: 'POST' });

export const getMembers = (bolaoId: string) => api<Member[]>(`/boloes/${bolaoId}/members`);
export const getInviteCode = (bolaoId: string) => api<{ code: string }>(`/boloes/${bolaoId}/invite`);
export const createInviteLink = (bolaoId: string) =>
  api<{ token: string; expires_at: string }>(`/boloes/${bolaoId}/invite/links`, { method: 'POST' });
export interface BolaoSettings {
  name: string;
  visibility: 'private' | 'public';
  requires_approval: boolean;
}

export const setMemberRole = (bolaoId: string, userId: string, role: 'admin' | 'participant') =>
  api(`/boloes/${bolaoId}/members/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
export const removeMember = (bolaoId: string, userId: string) => api(`/boloes/${bolaoId}/members/${userId}`, { method: 'DELETE' });
export const leaveBolao = (bolaoId: string) => api(`/boloes/${bolaoId}/leave`, { method: 'POST' });
export const rotateInviteCode = (bolaoId: string) => api<{ code: string }>(`/boloes/${bolaoId}/invite/rotate`, { method: 'POST' });
export const updateBolaoSettings = (bolaoId: string, settings: BolaoSettings) =>
  api(`/boloes/${bolaoId}`, { method: 'PATCH', body: JSON.stringify(settings) });
export const reviewRequest =(bolaoId: string, userId: string, decision: 'approve' | 'reject') =>
  api(`/boloes/${bolaoId}/members/${userId}/${decision}`, { method: 'POST' });
