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

export interface RoundsSummary {
  rounds: number[];
  /** Round to select by default: the first one after the latest with every result filled in. */
  active: number;
}

export async function getRoundsSummary(bolaoId?: string): Promise<RoundsSummary> {
  const q = bolaoId ? `?bolao_id=${bolaoId}` : '';
  return api<RoundsSummary>(`/matches/rounds/summary${q}`);
}

export async function getMatchesByRound(round: number): Promise<Match[]> {
  return api<Match[]>(`/matches/round/${round}`);
}
