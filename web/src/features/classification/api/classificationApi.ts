import { api } from '../../../shared/api/client';

export interface UserWithStats {
  id: string;
  username: string;
  display_name: string;
  favorite_team?: string;
  is_admin: boolean;
  amount_paid: number;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  rounds_won: number;
}

export async function getClassification(round?: number, bolaoId?: string, scope?: string): Promise<UserWithStats[]> {
  const params = new URLSearchParams();
  params.set('round', String(round ?? 0));
  if (bolaoId) params.set('bolao_id', bolaoId);
  const path = bolaoId ? '/classification' : `/boloes/${scope}/classification`;
  return api<UserWithStats[]>(`${path}?${params.toString()}`);
}
