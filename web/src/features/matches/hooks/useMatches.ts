import { useQuery } from '@tanstack/react-query';
import { getRoundsSummary, getMatchesByRound } from '../api/matchesApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useRounds(bolaoId?: string) {
  return useQuery({
    queryKey: queryKeys.rounds(bolaoId),
    queryFn: () => getRoundsSummary(bolaoId),
    select: (summary) => summary.rounds,
  });
}

export function useActiveRound(bolaoId?: string) {
  return useQuery({
    queryKey: queryKeys.rounds(bolaoId),
    queryFn: () => getRoundsSummary(bolaoId),
    select: (summary) => summary.active,
  });
}

export function usePendingResults(bolaoId?: string) {
  return useQuery({
    queryKey: queryKeys.rounds(bolaoId),
    queryFn: () => getRoundsSummary(bolaoId),
    select: (summary) => summary.pending_results,
  });
}

export function useMatchesByRound(round: number) {
  return useQuery({
    queryKey: queryKeys.matches(round),
    queryFn: () => getMatchesByRound(round),
    enabled: round > 0,
  });
}
