import { useQuery } from '@tanstack/react-query';
import { getRoundsSummary, getMatchesByRound } from '../api/matchesApi';
import { queryKeys } from '../../../shared/query/queryKeys';

// useRounds, useActiveRound and usePendingResults deliberately share a query key: React
// Query then issues a single request and all three resolve together, so the default round
// never jumps after the round list has rendered, and the admin banner costs nothing.
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
