import { useQuery } from '@tanstack/react-query';
import { getUsers, getPredictionsByUser } from '../api/viewPredictionsApi';
import { queryKeys } from '../../../shared/query/queryKeys';
import { useCurrentBolao } from '../../../shared/hooks/useCurrentBolao';

export function useUsers() {
  const { bolaoId: scope, isLoading } = useCurrentBolao();
  return useQuery({
    queryKey: queryKeys.users(scope),
    queryFn: () => getUsers(scope!),
    enabled: !isLoading && !!scope,
  });
}

export function usePredictionsByUser(round: number, userId: string | null) {
  const { bolaoId: scope, isLoading } = useCurrentBolao();
  return useQuery({
    queryKey: queryKeys.predictionsByUser(round, userId, scope),
    queryFn: () => getPredictionsByUser(round, userId!, scope!),
    enabled: round > 0 && !!userId && !isLoading && !!scope,
  });
}
