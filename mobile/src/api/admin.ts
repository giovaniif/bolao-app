import { api } from './client';
import type { RoundsSummary } from './play';

export const adminKeys = {
  summary: ['admin', 'rounds'] as const,
  matches: (round: number) => ['admin', 'matches', round] as const,
  active: ['admin', 'active-bolao'] as const,
  participants: (bolaoId: string) => ['admin', 'participants', bolaoId] as const,
};

export interface AdminMatch {
  id: string;
  round: number;
  home_team: string;
  away_team: string;
  market_closes_at?: string;
  home_goals?: number;
  away_goals?: number;
  provider_match_id?: number;
  locked: boolean;
}

export interface ActiveBolao {
  id: string;
  name: string;
  status: string;
  started_at: string;
}

export interface Participant {
  id: string;
  username: string;
  display_name: string;
  amount_paid: number;
}

export function getAdminRoundsSummary(): Promise<RoundsSummary> {
  return api<RoundsSummary>('/matches/rounds/summary');
}

export function getAdminMatches(round: number): Promise<AdminMatch[]> {
  return api<AdminMatch[]>(`/matches/round/${round}`);
}

export function setMatchResult(matchId: string, homeGoals: number, awayGoals: number): Promise<AdminMatch> {
  return api<AdminMatch>(`/matches/${matchId}/results`, { method: 'PUT', body: JSON.stringify({ home_goals: homeGoals, away_goals: awayGoals }) });
}

export function unlockMatch(matchId: string): Promise<AdminMatch> {
  return api<AdminMatch>(`/matches/${matchId}/lock`, { method: 'DELETE' });
}

export function getActiveBolao(): Promise<ActiveBolao> {
  return api<ActiveBolao>('/boloes/active');
}

export function getParticipants(bolaoId: string): Promise<Participant[]> {
  return api<Participant[]>(`/boloes/${bolaoId}/participants`);
}

export async function setAmountPaid(bolaoId: string, userId: string, amountPaid: number): Promise<void> {
  await api(`/boloes/${bolaoId}/participants/${userId}`, { method: 'PUT', body: JSON.stringify({ amount_paid: amountPaid }) });
}

export async function finishActiveBolao(force: boolean): Promise<void> {
  await api('/boloes/active/finish', { method: 'POST', body: JSON.stringify({ force }) });
}
