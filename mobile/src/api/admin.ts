import { api } from './client';
import type { RoundsSummary } from './play';

export const adminKeys = {
  summary: (bolaoId: string) => ['admin', bolaoId, 'rounds'] as const,
  matches: (bolaoId: string, round: number) => ['admin', bolaoId, 'matches', round] as const,
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

export function getAdminRoundsSummary(bolaoId: string): Promise<RoundsSummary> {
  return api<RoundsSummary>(`/boloes/${bolaoId}/matches/rounds/summary`);
}

export function getAdminMatches(bolaoId: string, round: number): Promise<AdminMatch[]> {
  return api<AdminMatch[]>(`/boloes/${bolaoId}/matches/round/${round}`);
}

export function setMatchResult(bolaoId: string, matchId: string, homeGoals: number, awayGoals: number): Promise<AdminMatch> {
  return api<AdminMatch>(`/boloes/${bolaoId}/matches/${matchId}/results`, { method: 'PUT', body: JSON.stringify({ home_goals: homeGoals, away_goals: awayGoals }) });
}

export function unlockMatch(bolaoId: string, matchId: string): Promise<AdminMatch> {
  return api<AdminMatch>(`/boloes/${bolaoId}/matches/${matchId}/lock`, { method: 'DELETE' });
}

export function setRoundCloses(bolaoId: string, round: number, closesAt: Date): Promise<AdminMatch[]> {
  return api<AdminMatch[]>(`/boloes/${bolaoId}/matches/round/${round}/closes`, { method: 'PUT', body: JSON.stringify({ market_closes_at: closesAt.toISOString() }) });
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
