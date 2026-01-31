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

export async function getClassification(round?: number): Promise<UserWithStats[]> {
  const q = round != null ? `?round=${round}` : '?round=999';
  return api<UserWithStats[]>(`/classification${q}`);
}
