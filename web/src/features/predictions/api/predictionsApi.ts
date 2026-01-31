import { api } from '../../../shared/api/client';

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  home_goals: number;
  away_goals: number;
}

export interface PredictionInput {
  match_id: string;
  home_goals: number;
  away_goals: number;
}

export async function getMyPredictions(round: number): Promise<Prediction[]> {
  return api<Prediction[]>(`/predictions?round=${round}`);
}

export async function savePredictions(
  predictions: PredictionInput[]
): Promise<void> {
  await api('/predictions', {
    method: 'POST',
    body: JSON.stringify({ predictions }),
  });
}
