import { api } from '../../../shared/api/client';

export interface User {
  id: string;
  username: string;
  display_name: string;
  favorite_team?: string;
  is_admin: boolean;
  amount_paid: number;
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

export async function getUsers(): Promise<User[]> {
  return api<User[]>('/users');
}

export async function createUser(data: {
  username: string;
  display_name: string;
  favorite_team?: string;
  is_admin?: boolean;
}): Promise<User> {
  return api<User>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUser(
  id: string,
  data: { display_name?: string; favorite_team?: string; amount_paid?: number }
): Promise<User> {
  return api<User>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getTeams(): Promise<string[]> {
  return api<string[]>('/teams');
}

export async function getRounds(): Promise<number[]> {
  return api<number[]>('/matches/rounds');
}

export async function getMatchesByRound(round: number): Promise<Match[]> {
  return api<Match[]>(`/matches/round/${round}`);
}

export async function createMatches(data: {
  round: number;
  market_closes_at?: string;
  matches: { home_team: string; away_team: string }[];
}): Promise<Match[]> {
  return api<Match[]>('/matches', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMatchResults(
  matchId: string,
  homeGoals: number,
  awayGoals: number
): Promise<Match> {
  return api<Match>(`/matches/${matchId}/results`, {
    method: 'PUT',
    body: JSON.stringify({ home_goals: homeGoals, away_goals: awayGoals }),
  });
}

export async function updateRoundCloses(
  round: number,
  marketClosesAt: string
): Promise<Match[]> {
  return api<Match[]>(`/matches/round/${round}/closes`, {
    method: 'PUT',
    body: JSON.stringify({ market_closes_at: marketClosesAt }),
  });
}

export async function updateMatch(
  matchId: string,
  data: { home_team: string; away_team: string }
): Promise<Match> {
  return api<Match>(`/matches/${matchId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteMatch(matchId: string): Promise<void> {
  await api(`/matches/${matchId}`, { method: 'DELETE' });
}

export async function deleteRound(round: number): Promise<void> {
  await api(`/matches/round/${round}`, { method: 'DELETE' });
}
