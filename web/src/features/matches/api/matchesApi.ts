import { api } from '../../../shared/api/client';

export interface Match {
  id: string;
  round: number;
  home_team: string;
  away_team: string;
  market_closes_at?: string;
  home_goals?: number;
  away_goals?: number;
}

export async function getRounds(bolaoId?: string): Promise<number[]> {
  const q = bolaoId ? `?bolao_id=${bolaoId}` : '';
  return api<number[]>(`/matches/rounds${q}`);
}

export async function getMatchesByRound(round: number): Promise<Match[]> {
  return api<Match[]>(`/matches/round/${round}`);
}
