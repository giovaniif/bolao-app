import { scopedPath } from '../../../shared/api/scopedPath';
import { api } from '../../../shared/api/client';

export interface MatchWithPartial {
  id: string;
  home_team: string;
  away_team: string;
  status?: string;
  partial_home?: number;
  partial_away?: number;
  real_home_goals?: number;
  real_away_goals?: number;
}

export interface UserWithStats {
  id: string;
  username: string;
  display_name: string;
  favorite_team?: string;
  total_points: number;
  exact_scores: number;
  correct_results: number;
}

export async function getPartialsByRound(round: number, scope?: string): Promise<MatchWithPartial[]> {
  return api<MatchWithPartial[]>(scopedPath(`/parciais/round/${round}`, scope));
}

export async function setPartial(
  matchId: string,
  homeGoals: number,
  awayGoals: number
): Promise<{ match_id: string; home_goals: number; away_goals: number }> {
  return api(`/parciais/match/${matchId}`, {
    method: 'PUT',
    body: JSON.stringify({ home_goals: homeGoals, away_goals: awayGoals }),
  });
}

export async function clearPartial(matchId: string): Promise<void> {
  await api(`/parciais/match/${matchId}`, { method: 'DELETE' });
}

export async function getPartialClassification(
  round: number,
  scope?: string
): Promise<UserWithStats[]> {
  return api<UserWithStats[]>(scopedPath(`/parciais/round/${round}/classification`, scope));
}
