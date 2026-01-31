import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getUsers,
  getTeams,
  getRounds,
  getMatchesByRound,
  createMatches,
  updateMatch,
  updateMatchResults,
  updateRoundCloses,
  deleteMatch,
  deleteRound,
  createUser,
  updateUser,
} from '../api/adminApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: getUsers,
  });
}

export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams,
    queryFn: getTeams,
  });
}

export function useRounds() {
  return useQuery({
    queryKey: queryKeys.rounds,
    queryFn: getRounds,
  });
}

export function useMatchesByRound(round: number) {
  return useQuery({
    queryKey: queryKeys.matches(round),
    queryFn: () => getMatchesByRound(round),
    enabled: round > 0,
  });
}

export function useCreateMatches() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMatches,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(variables.round) });
    },
  });
}

export function useUpdateMatchResults(round: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      matchId,
      homeGoals,
      awayGoals,
    }: {
      matchId: string;
      homeGoals: number;
      awayGoals: number;
    }) => updateMatchResults(matchId, homeGoals, awayGoals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(round) });
      queryClient.invalidateQueries({ queryKey: ['classification'] });
    },
  });
}

export function useUpdateRoundCloses(round: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (marketClosesAt: string) => updateRoundCloses(round, marketClosesAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(round) });
    },
  });
}

export function useUpdateMatch(round: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      matchId,
      home_team,
      away_team,
    }: {
      matchId: string;
      home_team: string;
      away_team: string;
    }) => updateMatch(matchId, { home_team, away_team }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(round) });
    },
  });
}

export function useDeleteMatch(round: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(round) });
    },
  });
}

export function useDeleteRound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRound,
    onSuccess: (_, roundNum) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(roundNum) });
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions(roundNum) });
      queryClient.invalidateQueries({ queryKey: ['classification'] });
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { display_name?: string; favorite_team?: string; amount_paid?: number };
    }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}
