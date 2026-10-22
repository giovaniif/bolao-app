import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { joinPublicBolao, searchPublicBoloes } from '../api/publicBoloesApi';
import { queryKeys } from '../../../shared/query/queryKeys';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { track } from '../../../shared/analytics/analytics';

const SEARCH_DELAY_MS = 400;

export function usePublicBoloes(query: string, enabled = true) {
  const debounced = useDebouncedValue(query.trim(), SEARCH_DELAY_MS);
  return useQuery({
    queryKey: queryKeys.publicBoloes(debounced),
    queryFn: () => searchPublicBoloes(debounced),
    enabled,
  });
}

export function useJoinPublicBolao() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: joinPublicBolao,
    onSuccess: async (result) => {
      track(result.status === 'active' ? 'bolao_joined' : 'join_requested');
      await queryClient.invalidateQueries({ queryKey: queryKeys.myBoloes });
      if (result.status === 'active') navigate(`/palpites?bolao=${result.bolao_id}`);
    },
  });
}

export function useExploreBoloes(enabled = true) {
  const [query, setQuery] = useState('');
  const { data: boloes = [], isLoading } = usePublicBoloes(query, enabled);
  const join = useJoinPublicBolao();
  return {
    query,
    setQuery,
    boloes,
    isLoading,
    join: join.mutate,
    joiningId: join.isPending ? join.variables : undefined,
    requested: join.data?.status === 'pending',
    error: join.error instanceof Error ? join.error.message : '',
  };
}
