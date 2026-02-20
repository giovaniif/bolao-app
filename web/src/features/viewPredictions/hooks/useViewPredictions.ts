import { useQuery } from '@tanstack/react-query';
import { getUsers, getPredictionsByUser } from '../api/viewPredictionsApi';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });
}

export function usePredictionsByUser(round: number, userId: string | null) {
  return useQuery({
    queryKey: ['predictionsByUser', round, userId],
    queryFn: () => getPredictionsByUser(round, userId!),
    enabled: round > 0 && !!userId,
  });
}
