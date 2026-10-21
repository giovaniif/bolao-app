import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyPredictions, savePredictions, type PredictionInput } from '../api/predictionsApi';
import { queryKeys } from '../../../shared/query/queryKeys';
import { useCurrentBolao } from '../../../shared/hooks/useCurrentBolao';
import { track } from '../../../shared/analytics/analytics';

export function useMyPredictions(round: number) {
  const { bolaoId: scope, isLoading } = useCurrentBolao();
  return useQuery({
    queryKey: queryKeys.predictions(round, scope),
    queryFn: () => getMyPredictions(round, scope!),
    enabled: round > 0 && !isLoading && !!scope,
  });
}

export function useSavePredictions(round: number) {
  const queryClient = useQueryClient();
  const { bolaoId: scope } = useCurrentBolao();
  return useMutation({
    mutationFn: (predictions: PredictionInput[]) => {
      if (!scope) throw new Error('Nenhum bolão selecionado');
      return savePredictions(predictions, scope);
    },
    onSuccess: (_result, predictions) => {
      track('predictions_saved', { round, count: predictions.length });
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions(round) });
    },
  });
}
