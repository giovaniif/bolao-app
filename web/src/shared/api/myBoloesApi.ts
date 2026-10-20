import { api } from './client';

export interface MyBolao {
  id: string;
  name: string;
  status: 'active' | 'finished';
  role: 'owner' | 'admin' | 'participant';
  member_status: 'pending' | 'active';
  member_count: number;
  visibility?: 'private' | 'public';
  requires_approval?: boolean;
  max_members?: number;
  competition_id?: string;
}

export async function getMyBoloes(): Promise<MyBolao[]> {
  return api<MyBolao[]>('/me/boloes');
}
