import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBolao,
  getCompetitions,
  getRules,
  updateBolaoSettings,
  type BolaoSettings,
} from '../api/createBolaoApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useCompetitions() {
  return useQuery({ queryKey: queryKeys.competitions, queryFn: getCompetitions, staleTime: Infinity });
}

export function useRules() {
  return useQuery({ queryKey: queryKeys.rules, queryFn: getRules, staleTime: Infinity });
}

export function useCreateBolao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ settings, competitionId }: { settings: BolaoSettings; competitionId?: string }) => {
      const bolao = await createBolao(settings.name, competitionId);
      await updateBolaoSettings(bolao.id, settings);
      return bolao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myBoloes });
    },
  });
}
