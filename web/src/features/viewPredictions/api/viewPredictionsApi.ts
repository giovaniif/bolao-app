import { api } from '../../../shared/api/client';

export interface UserOption {
  id: string;
  username: string;
  display_name: string;
}

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  home_goals: number;
  away_goals: number;
}

export async function getUsers(): Promise<UserOption[]> {
  const list = await api<{ id: string; username: string; display_name: string }[]>('/users');
  return list.map((u) => ({ id: u.id, username: u.username, display_name: u.display_name }));
}

export async function getPredictionsByUser(
  round: number,
  userId: string
): Promise<Prediction[]> {
  return api<Prediction[]>(`/predictions/round/${round}/user/${userId}`);
}
