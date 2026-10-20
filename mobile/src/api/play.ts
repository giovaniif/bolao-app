import { api } from './client';

export interface MyBolao {
  id: string;
  name: string;
  status: 'active' | 'finished';
  role: 'owner' | 'admin' | 'participant';
  member_status: 'pending' | 'active';
  member_count: number;
}

export interface RoundsSummary {
  rounds: number[];
  active: number;
  pending_results: number;
}

export interface Match {
  id: string;
  round: number;
  home_team: string;
  away_team: string;
  market_closes_at?: string;
  home_goals?: number;
  away_goals?: number;
}

export interface Prediction {
  match_id: string;
  home_goals: number;
  away_goals: number;
}

export interface Standing {
  id: string;
  username: string;
  display_name: string;
  total_points: number;
  exact_scores: number;
  correct_results: number;
}

export function getMyBoloes(): Promise<MyBolao[]> {
  return api<MyBolao[]>('/me/boloes');
}

export function getRoundsSummary(bolaoId: string): Promise<RoundsSummary> {
  return api<RoundsSummary>(`/boloes/${bolaoId}/matches/rounds/summary`);
}

export function getMatches(bolaoId: string, round: number): Promise<Match[]> {
  return api<Match[]>(`/boloes/${bolaoId}/matches/round/${round}`);
}

export function getMyPredictions(bolaoId: string, round: number): Promise<Prediction[]> {
  return api<Prediction[]>(`/boloes/${bolaoId}/predictions?round=${round}`);
}

export async function savePredictions(bolaoId: string, predictions: Prediction[]): Promise<void> {
  await api(`/boloes/${bolaoId}/predictions`, { method: 'POST', body: JSON.stringify({ predictions }) });
}

export function getStandings(bolaoId: string): Promise<Standing[]> {
  return api<Standing[]>(`/boloes/${bolaoId}/classification`);
}
