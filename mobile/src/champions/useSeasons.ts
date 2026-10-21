import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { getMyBoloes, getStandings } from '../api/play';
import { useAuth } from '../auth/AuthProvider';
import { bolaoKeys } from '../bolao/useCurrentBolao';
import { buildSeason, byRecencyDesc, type Season } from './season';

export function useSeasons() {
  const { token } = useAuth();
  const mine = useQuery({ queryKey: bolaoKeys.mine, queryFn: getMyBoloes, enabled: !!token });
  const finished = useMemo(
    () => (mine.data ?? []).filter((b) => b.status === 'finished' && b.member_status === 'active').sort(byRecencyDesc),
    [mine.data]
  );
  const { rankings, loadingRankings } = useQueries({
    queries: finished.map((b) => ({
      queryKey: ['classification', b.id, 'geral'],
      queryFn: () => getStandings(b.id),
      staleTime: Infinity,
    })),
    combine: (results) => ({
      rankings: results.map((r) => r.data ?? []),
      loadingRankings: results.some((r) => r.isLoading),
    }),
  });
  const seasons: Season[] = useMemo(() => finished.map((b, i) => buildSeason(b, rankings[i] ?? [])), [finished, rankings]);
  return { seasons, isLoading: !token || mine.isLoading || loadingRankings };
}
