import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getUsers,
  getTeams,
  getMatchesByRound,
  createMatches,
  updateMatch,
  updateMatchResults,
  updateRoundCloses,
  deleteMatch,
  deleteRound,
  createUser,
  updateUser,
  unlockMatch,
} from '../api/adminApi';
import { queryKeys } from '../../../shared/query/queryKeys';
import { useCurrentBolao } from '../../../shared/hooks/useCurrentBolao';

function requireBolao(bolaoId: string | undefined): string {
  if (!bolaoId) throw new Error('Nenhum bolão selecionado');
  return bolaoId;
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users(),
    queryFn: getUsers,
  });
}

export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams,
    queryFn: getTeams,
  });
}

export { useRounds } from '../../matches/hooks/useMatches';

export function useMatchesByRound(round: number) {
  const { bolaoId } = useCurrentBolao();
  return useQuery({
    queryKey: queryKeys.matches(round, bolaoId),
    queryFn: () => getMatchesByRound(bolaoId!, round),
    enabled: round > 0 && !!bolaoId,
  });
}

export function useCreateMatches() {
  const queryClient = useQueryClient();
  const { bolaoId } = useCurrentBolao();
  return useMutation({
    mutationFn: (data: Parameters<typeof createMatches>[1]) => createMatches(requireBolao(bolaoId), data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds() });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(variables.round) });
    },
  });
}

export function useUpdateMatchResults(round: number) {
  const queryClient = useQueryClient();
  const { bolaoId } = useCurrentBolao();
  return useMutation({
    mutationFn: ({
      matchId,
      homeGoals,
      awayGoals,
    }: {
      matchId: string;
      homeGoals: number;
      awayGoals: number;
    }) => updateMatchResults(requireBolao(bolaoId), matchId, homeGoals, awayGoals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(round) });
      queryClient.invalidateQueries({ queryKey: ['classification'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds() });
    },
  });
}

export function useUnlockMatch(round: number) {
  const queryClient = useQueryClient();
  const { bolaoId } = useCurrentBolao();
  return useMutation({
    mutationFn: (matchId: string) => unlockMatch(requireBolao(bolaoId), matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(round) });
    },
  });
}

export function useUpdateRoundCloses(round: number) {
  const queryClient = useQueryClient();
  const { bolaoId } = useCurrentBolao();
  return useMutation({
    mutationFn: (marketClosesAt: string) => updateRoundCloses(requireBolao(bolaoId), round, marketClosesAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(round) });
    },
  });
}

export function useUpdateMatch(round: number) {
  const queryClient = useQueryClient();
  const { bolaoId } = useCurrentBolao();
  return useMutation({
    mutationFn: ({
      matchId,
      home_team,
      away_team,
    }: {
      matchId: string;
      home_team: string;
      away_team: string;
    }) => updateMatch(requireBolao(bolaoId), matchId, { home_team, away_team }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(round) });
    },
  });
}

export function useDeleteMatch(round: number) {
  const queryClient = useQueryClient();
  const { bolaoId } = useCurrentBolao();
  return useMutation({
    mutationFn: (matchId: string) => deleteMatch(requireBolao(bolaoId), matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds() });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(round) });
    },
  });
}

export function useDeleteRound() {
  const queryClient = useQueryClient();
  const { bolaoId } = useCurrentBolao();
  return useMutation({
    mutationFn: (round: number) => deleteRound(requireBolao(bolaoId), round),
    onSuccess: (_, roundNum) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rounds() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.boloes });
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
      data: { display_name?: string; favorite_team?: string };
    }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });
}
