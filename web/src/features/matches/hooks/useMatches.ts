import { useQuery } from '@tanstack/react-query';
import { getRoundsSummary, getMatchesByRound } from '../api/matchesApi';
import { queryKeys } from '../../../shared/query/queryKeys';
import { useCurrentBolao } from '../../../shared/hooks/useCurrentBolao';

export function useRounds(bolaoId?: string) {
  const { bolaoId: scope, isLoading } = useCurrentBolao();
  return useQuery({
    queryKey: queryKeys.rounds(bolaoId, scope),
    queryFn: () => getRoundsSummary(bolaoId, scope),
    enabled: !isLoading,
    select: (summary) => summary.rounds,
  });
}

export function useActiveRound(bolaoId?: string) {
  const { bolaoId: scope, isLoading } = useCurrentBolao();
  return useQuery({
    queryKey: queryKeys.rounds(bolaoId, scope),
    queryFn: () => getRoundsSummary(bolaoId, scope),
    enabled: !isLoading,
    select: (summary) => summary.active,
  });
}

export function usePendingResults(bolaoId?: string) {
  const { bolaoId: scope, isLoading } = useCurrentBolao();
  return useQuery({
    queryKey: queryKeys.rounds(bolaoId, scope),
    queryFn: () => getRoundsSummary(bolaoId, scope),
    enabled: !isLoading,
    select: (summary) => summary.pending_results,
  });
}

export function useMatchesByRound(round: number) {
  const { bolaoId: scope, isLoading } = useCurrentBolao();
  return useQuery({
    queryKey: queryKeys.matches(round, scope),
    queryFn: () => getMatchesByRound(round, scope),
    enabled: round > 0 && !isLoading,
  });
}
