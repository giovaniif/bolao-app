import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMyBoloes, type MyBolao } from '../api/myBoloesApi';
import { queryKeys } from '../query/queryKeys';

const BOLAO_KEY = 'bolao';

function readStored(): string | null {
  try {
    return localStorage.getItem(BOLAO_KEY);
  } catch {
    return null;
  }
}

function store(id: string) {
  try {
    localStorage.setItem(BOLAO_KEY, id);
  } catch {
    return;
  }
}

export function useMyBoloes() {
  return useQuery({ queryKey: queryKeys.myBoloes, queryFn: getMyBoloes });
}

export function useCurrentBolao() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: boloes = [], isLoading } = useMyBoloes();
  const playable = boloes.filter((b) => b.member_status === 'active');
  const find = (id: string | null) => (id ? playable.find((b) => b.id === id) : undefined);

  const fromUrl = find(searchParams.get(BOLAO_KEY));
  const bolao: MyBolao | undefined =
    fromUrl ??
    find(readStored()) ??
    playable.find((b) => b.status === 'active') ??
    playable[0];

  useEffect(() => {
    if (fromUrl) store(fromUrl.id);
  }, [fromUrl]);

  const select = useCallback(
    (id: string) => {
      store(id);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(BOLAO_KEY, id);
          next.delete('rodada');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { bolaoId: bolao?.id, bolao, boloes, isLoading, select };
}
