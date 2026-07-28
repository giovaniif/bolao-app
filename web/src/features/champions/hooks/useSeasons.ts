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
  /** Empty while loading. */
  ranking: UserWithStats[];
  champion?: UserWithStats;
  runnerUp?: UserWithStats;
  third?: UserWithStats;
  players: number;
  /** Points between the champion and the runner-up; 0 when there is no runner-up. */
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

/**
 * Finished bolões, newest first, each with its ranking.
 *
 * The key is identical to the one useClassification(undefined, bolaoId) produces, so the
 * Classificação card, the champion hero and the gallery share one cache entry per season.
 * staleTime is infinite because a finished bolão's ranking is immutable; without it,
 * switching between the Hall views would refetch every season.
 */
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
