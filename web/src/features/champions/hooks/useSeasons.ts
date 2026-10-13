import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/query/queryKeys';
import { getClassification } from '../../classification/api/classificationApi';
import type { UserWithStats } from '../../classification/api/classificationApi';
import type { Bolao } from '../../boloes/api/boloesApi';
import { useBoloes } from '../../boloes/hooks/useBoloes';
import { byRecencyDesc, seasonYear } from '../utils/season';

export interface Season {
  bolao: Bolao;
  year: number;
  ranking: UserWithStats[];
  champion?: UserWithStats;
  runnerUp?: UserWithStats;
  third?: UserWithStats;
  players: number;
  margin: number;
  tiedForFirst: boolean;
}

function isTie(a: UserWithStats, b: UserWithStats): boolean {
  return (
    a.total_points === b.total_points &&
    a.exact_scores === b.exact_scores &&
    a.correct_results === b.correct_results &&
    a.rounds_won === b.rounds_won
  );
}

export function useSeasons() {
  const { data: boloes = [], isLoading: loadingBoloes } = useBoloes();

  const finished = useMemo(
    () => boloes.filter((b) => b.status === 'finished').sort(byRecencyDesc),
    [boloes]
  );

  const { rankings, loadingRankings } = useQueries({
    queries: finished.map((b) => ({
      queryKey: queryKeys.classification(b.id, undefined),
      queryFn: () => getClassification(undefined, b.id),
      staleTime: Infinity,
    })),
    combine: (results) => ({
      rankings: results.map((r) => r.data ?? []),
      loadingRankings: results.some((r) => r.isLoading),
    }),
  });

  const seasons: Season[] = useMemo(
    () =>
      finished.map((bolao, i) => {
        const ranking = rankings[i] ?? [];
        const [champion, runnerUp, third] = ranking;
        return {
          bolao,
          year: seasonYear(bolao),
          ranking,
          champion,
          runnerUp,
          third,
          players: ranking.length,
          margin: champion && runnerUp ? champion.total_points - runnerUp.total_points : 0,
          tiedForFirst: !!(champion && runnerUp && isTie(champion, runnerUp)),
        };
      }),
    [finished, rankings]
  );

  return { seasons, isLoading: loadingBoloes || loadingRankings };
}
