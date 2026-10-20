import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyPredictions, savePredictions, type PredictionInput } from '../api/predictionsApi';
import { queryKeys } from '../../../shared/query/queryKeys';
import { useCurrentBolao } from '../../../shared/hooks/useCurrentBolao';

export function useMyPredictions(round: number) {
  const { bolaoId: scope, isLoading } = useCurrentBolao();
  return useQuery({
    queryKey: queryKeys.predictions(round, scope),
    queryFn: () => getMyPredictions(round, scope),
    enabled: round > 0 && !isLoading,
  });
}

export function useSavePredictions(round: number) {
  const queryClient = useQueryClient();
  const { bolaoId: scope } = useCurrentBolao();
  return useMutation({
    mutationFn: (predictions: PredictionInput[]) => savePredictions(predictions, scope),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions(round) });
    },
  });
}
