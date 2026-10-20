import { api } from '../../../shared/api/client';

export type MemberRole = 'owner' | 'admin' | 'participant';

export interface Member {
  id: string;
  username: string;
  display_name: string;
  role: MemberRole;
  status: 'active' | 'pending';
  amount_paid: number;
}

export interface InviteLink {
  token: string;
  expires_at: string;
}

export async function getMembers(bolaoId: string): Promise<Member[]> {
  return api<Member[]>(`/boloes/${bolaoId}/members`);
}

export async function reviewRequest(bolaoId: string, userId: string, decision: 'approve' | 'reject'): Promise<void> {
  await api(`/boloes/${bolaoId}/members/${userId}/${decision}`, { method: 'POST' });
}

export async function setMemberRole(bolaoId: string, userId: string, role: MemberRole): Promise<void> {
  await api(`/boloes/${bolaoId}/members/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
}

export async function removeMember(bolaoId: string, userId: string): Promise<void> {
  await api(`/boloes/${bolaoId}/members/${userId}`, { method: 'DELETE' });
}

export async function getInviteCode(bolaoId: string): Promise<{ code: string }> {
  return api<{ code: string }>(`/boloes/${bolaoId}/invite`);
}

export async function createInviteLink(bolaoId: string): Promise<InviteLink> {
  return api<InviteLink>(`/boloes/${bolaoId}/invite/links`, { method: 'POST' });
}
