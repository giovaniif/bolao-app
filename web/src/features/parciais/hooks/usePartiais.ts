import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPartialsByRound,
  setPartial,
  clearPartial,
  getPartialClassification,
} from '../api/parciaisApi';
import { queryKeys } from '../../../shared/query/queryKeys';
import { useCurrentBolao } from '../../../shared/hooks/useCurrentBolao';

export function usePartialsByRound(round: number) {
  const { bolaoId: scope, isLoading } = useCurrentBolao();
  return useQuery({
    queryKey: queryKeys.partials(round, scope),
    queryFn: () => getPartialsByRound(round, scope),
    enabled: round > 0 && !isLoading,
  });
}

export function usePartialClassification(round: number) {
  const { bolaoId: scope, isLoading } = useCurrentBolao();
  return useQuery({
    queryKey: queryKeys.partialClassification(round, scope),
    queryFn: () => getPartialClassification(round, scope),
    enabled: round > 0 && !isLoading,
  });
}

export function useSetPartial(round: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, homeGoals, awayGoals }: { matchId: string; homeGoals: number; awayGoals: number }) =>
      setPartial(matchId, homeGoals, awayGoals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partials(round) });
      queryClient.invalidateQueries({ queryKey: queryKeys.partialClassification(round) });
    },
  });
}

export function useClearPartial(round: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => clearPartial(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partials(round) });
      queryClient.invalidateQueries({ queryKey: queryKeys.partialClassification(round) });
    },
  });
}
