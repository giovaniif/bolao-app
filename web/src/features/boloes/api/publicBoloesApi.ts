import { api } from '../../../shared/api/client';

export interface PublicBolao {
  id: string;
  name: string;
  requires_approval: boolean;
  max_members: number;
  member_count: number;
}

export interface JoinResult {
  bolao_id: string;
  status: 'active' | 'pending';
}

export async function searchPublicBoloes(query: string): Promise<PublicBolao[]> {
  const q = query.trim();
  const search = q ? `?${new URLSearchParams({ q })}` : '';
  return api<PublicBolao[]>(`/boloes/public${search}`);
}

export async function joinPublicBolao(bolaoId: string): Promise<JoinResult> {
  return api<JoinResult>(`/boloes/${bolaoId}/join`, { method: 'POST' });
}
