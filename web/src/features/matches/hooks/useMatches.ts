import { useQuery } from '@tanstack/react-query';
import { getRounds, getMatchesByRound } from '../api/matchesApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useRounds(bolaoId?: string) {
  return useQuery({
    queryKey: queryKeys.rounds(bolaoId),
    queryFn: () => getRounds(bolaoId),
  });
}

export function useMatchesByRound(round: number) {
  return useQuery({
    queryKey: queryKeys.matches(round),
    queryFn: () => getMatchesByRound(round),
    enabled: round > 0,
  });
}
