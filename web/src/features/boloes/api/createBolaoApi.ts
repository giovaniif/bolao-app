import { api } from '../../../shared/api/client';

export interface Competition {
  id: string;
  name: string;
  provider_code: string;
  season: number;
}

export interface Rule {
  key: string;
  points: number;
  text: string;
}

export interface BonusTier {
  score_types: number;
  points: number;
  text: string;
}

export interface RuleBook {
  match: Rule[];
  round: Rule[];
  exact_score_variety_bonus: BonusTier[];
  notes: string[];
}

export interface BolaoSettings {
  name: string;
  visibility: 'private' | 'public';
  requires_approval: boolean;
}

export interface CreatedBolao {
  id: string;
  name: string;
}

export async function getCompetitions(): Promise<Competition[]> {
  return api<Competition[]>('/competitions');
}

export async function getRules(): Promise<RuleBook> {
  return api<RuleBook>('/rules');
}

export async function createBolao(name: string, competitionId?: string): Promise<CreatedBolao> {
  return api<CreatedBolao>('/me/boloes', {
    method: 'POST',
    body: JSON.stringify(competitionId ? { name, competition_id: competitionId } : { name }),
  });
}

export async function updateBolaoSettings(bolaoId: string, settings: BolaoSettings): Promise<void> {
  await api(`/boloes/${bolaoId}`, { method: 'PATCH', body: JSON.stringify(settings) });
}
