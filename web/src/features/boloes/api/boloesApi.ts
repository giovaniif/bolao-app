import { api } from '../../../shared/api/client';

export interface Bolao {
  id: string;
  name: string;
  status: 'active' | 'finished';
  started_at: string;
  finished_at?: string;
}

export interface Participant {
  id: string;
  username: string;
  display_name: string;
  favorite_team?: string;
  is_admin: boolean;
  amount_paid: number;
  joined_at: string;
}

export class UnresolvedMatchesError extends Error {
  rounds: number[];
  count: number;
  constructor(rounds: number[], count: number) {
    super('existem jogos sem resultado definido');
    this.rounds = rounds;
    this.count = count;
  }
}

export async function getBoloes(): Promise<Bolao[]> {
  return api<Bolao[]>('/boloes');
}

export async function getActiveBolao(): Promise<Bolao | null> {
  try {
    return await api<Bolao>('/boloes/active');
  } catch {
    return null;
  }
}

export async function getBolaoParticipants(bolaoId: string): Promise<Participant[]> {
  return api<Participant[]>(`/boloes/${bolaoId}/participants`);
}

export async function createBolao(name: string): Promise<Bolao> {
  return api<Bolao>('/boloes', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function finishActiveBolao(force = false): Promise<Bolao> {
  try {
    return await api<Bolao>('/boloes/active/finish', {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
  } catch (err) {
    const withBody = err as Error & { status?: number; body?: { rounds?: number[]; count?: number } };
    if (withBody.status === 409 && withBody.body?.rounds) {
      throw new UnresolvedMatchesError(withBody.body.rounds, withBody.body.count ?? 0);
    }
    throw err;
  }
}

export async function updateParticipantAmountPaid(
  bolaoId: string,
  userId: string,
  amountPaid: number
): Promise<void> {
  await api(`/boloes/${bolaoId}/participants/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ amount_paid: amountPaid }),
  });
}
