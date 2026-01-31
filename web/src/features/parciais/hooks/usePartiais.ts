import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPartialsByRound,
  setPartial,
  getPartialClassification,
} from '../api/parciaisApi';

export function usePartialsByRound(round: number) {
  return useQuery({
    queryKey: ['parciais', round],
    queryFn: () => getPartialsByRound(round),
    enabled: round > 0,
  });
}

export function usePartialClassification(round: number) {
  return useQuery({
    queryKey: ['parciais', 'classification', round],
    queryFn: () => getPartialClassification(round),
    enabled: round > 0,
  });
}

export function useSetPartial(round: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, homeGoals, awayGoals }: { matchId: string; homeGoals: number; awayGoals: number }) =>
      setPartial(matchId, homeGoals, awayGoals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parciais', round] });
      queryClient.invalidateQueries({ queryKey: ['parciais', 'classification', round] });
    },
  });
}
