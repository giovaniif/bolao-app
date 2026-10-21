import { api } from './client';

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

export interface PartialStanding {
  id: string;
  display_name: string;
  total_points: number;
}

export interface Member {
  id: string;
  username: string;
  display_name: string;
  role: 'owner' | 'admin' | 'participant';
  status: 'pending' | 'active' | 'removed';
}

export interface PlayerPrediction {
  id: string;
  user_id: string;
  match_id: string;
  home_goals: number;
  away_goals: number;
}

export function getPartials(bolaoId: string, round: number): Promise<MatchWithPartial[]> {
  return api<MatchWithPartial[]>(`/boloes/${bolaoId}/parciais/round/${round}`);
}

export function getPartialStandings(bolaoId: string, round: number): Promise<PartialStanding[]> {
  return api<PartialStanding[]>(`/boloes/${bolaoId}/parciais/round/${round}/classification`);
}

export async function setPartial(matchId: string, homeGoals: number, awayGoals: number): Promise<void> {
  await api(`/parciais/match/${matchId}`, { method: 'PUT', body: JSON.stringify({ home_goals: homeGoals, away_goals: awayGoals }) });
}

export async function clearPartial(matchId: string): Promise<void> {
  await api(`/parciais/match/${matchId}`, { method: 'DELETE' });
}

export function getMembers(bolaoId: string): Promise<Member[]> {
  return api<Member[]>(`/boloes/${bolaoId}/members`);
}

export function getPlayerPredictions(bolaoId: string, round: number, userId: string): Promise<PlayerPrediction[]> {
  return api<PlayerPrediction[]>(`/boloes/${bolaoId}/predictions/round/${round}/user/${userId}`);
}
