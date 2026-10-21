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
  active: number;
  pending_results: number;
}

export async function getRoundsSummary(bolaoId?: string, scope?: string): Promise<RoundsSummary> {
  if (bolaoId) return api<RoundsSummary>(`/matches/rounds/summary?bolao_id=${bolaoId}`);
  return api<RoundsSummary>(`/boloes/${scope}/matches/rounds/summary`);
}

export async function getMatchesByRound(round: number, scope: string): Promise<Match[]> {
  return api<Match[]>(`/boloes/${scope}/matches/round/${round}`);
}
