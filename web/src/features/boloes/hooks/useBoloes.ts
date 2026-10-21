import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBoloes,
  getBolaoParticipants,
  createBolao,
  finishBolao,
  updateParticipantAmountPaid,
} from '../api/boloesApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useBoloes() {
  return useQuery({
    queryKey: queryKeys.boloes,
    queryFn: getBoloes,
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

export function useFinishBolao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bolaoId, force }: { bolaoId: string; force: boolean }) => finishBolao(bolaoId, force),
    onSuccess: () => {
      invalidateBolaoSwitch(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.myBoloes });
    },
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
