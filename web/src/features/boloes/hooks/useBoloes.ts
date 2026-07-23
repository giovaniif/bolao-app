import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBoloes,
  getActiveBolao,
  getBolaoParticipants,
  createBolao,
  finishActiveBolao,
  updateParticipantAmountPaid,
} from '../api/boloesApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useBoloes() {
  return useQuery({
    queryKey: queryKeys.boloes,
    queryFn: getBoloes,
  });
}

export function useActiveBolao() {
  return useQuery({
    queryKey: queryKeys.activeBolao,
    queryFn: getActiveBolao,
  });
}

export function useBolaoParticipants(bolaoId?: string) {
  return useQuery({
    queryKey: queryKeys.bolaoParticipants(bolaoId ?? ''),
    queryFn: () => getBolaoParticipants(bolaoId!),
    enabled: !!bolaoId,
  });
}

function invalidateBolaoSwitch(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.boloes });
  queryClient.invalidateQueries({ queryKey: queryKeys.activeBolao });
  queryClient.invalidateQueries({ queryKey: queryKeys.rounds() });
  queryClient.invalidateQueries({ queryKey: ['matches'] });
  queryClient.invalidateQueries({ queryKey: ['classification'] });
}

export function useCreateBolao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBolao,
    onSuccess: () => invalidateBolaoSwitch(queryClient),
  });
}

export function useFinishActiveBolao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (force: boolean) => finishActiveBolao(force),
    onSuccess: () => invalidateBolaoSwitch(queryClient),
  });
}

export function useUpdateParticipantAmountPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bolaoId,
      userId,
      amountPaid,
    }: {
      bolaoId: string;
      userId: string;
      amountPaid: number;
    }) => updateParticipantAmountPaid(bolaoId, userId, amountPaid),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bolaoParticipants(variables.bolaoId) });
    },
  });
}
