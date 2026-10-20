import { scopedPath } from '../../../shared/api/scopedPath';
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

export async function getMyPredictions(round: number, scope?: string): Promise<Prediction[]> {
  return api<Prediction[]>(scopedPath(`/predictions?round=${round}`, scope));
}

export async function savePredictions(
  predictions: PredictionInput[],
  scope?: string
): Promise<void> {
  await api(scopedPath('/predictions', scope), {
    method: 'POST',
    body: JSON.stringify({ predictions }),
  });
}
