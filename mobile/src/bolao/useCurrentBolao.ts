import { useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyBoloes, type MyBolao } from '../api/play';
import { useAuth } from '../auth/AuthProvider';

const BOLAO_KEY = 'bolao';

export const bolaoKeys = {
  mine: ['me', 'boloes'] as const,
  chosen: ['chosen-bolao'] as const,
};

export function useCurrentBolao() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: bolaoKeys.mine, queryFn: getMyBoloes, enabled: !!token });
  const chosen = useQuery({ queryKey: bolaoKeys.chosen, queryFn: async () => (await SecureStore.getItemAsync(BOLAO_KEY)) ?? '' });
  const boloes = mine.data ?? [];
  const playable = boloes.filter((b) => b.member_status === 'active');
  const bolao: MyBolao | undefined =
    playable.find((b) => b.id === chosen.data) ?? playable.find((b) => b.status === 'active') ?? playable[0];

  const select = useCallback(
    async (id: string) => {
      queryClient.setQueryData(bolaoKeys.chosen, id);
      await SecureStore.setItemAsync(BOLAO_KEY, id);
    },
    [queryClient]
  );

  return { bolao, boloes, select, isLoading: !token || mine.isLoading || chosen.isLoading };
}
