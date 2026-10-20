import { api } from '../../../shared/api/client';

export interface InvitePreview {
  name: string;
  member_count: number;
  max_members: number;
  joins: 'direct' | 'request';
}

export interface JoinResult {
  bolao_id: string;
  status: 'active' | 'pending';
}

export async function getInvitePreview(code: string): Promise<InvitePreview> {
  return api<InvitePreview>(`/invites/${encodeURIComponent(code)}`);
}

export async function joinInvite(code: string): Promise<JoinResult> {
  return api<JoinResult>(`/invites/${encodeURIComponent(code)}/join`, { method: 'POST' });
}
