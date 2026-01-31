import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyPredictions, savePredictions } from '../api/predictionsApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useMyPredictions(round: number) {
  return useQuery({
    queryKey: queryKeys.predictions(round),
    queryFn: () => getMyPredictions(round),
    enabled: round > 0,
  });
}

export function useSavePredictions(round: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: savePredictions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions(round) });
    },
  });
}
