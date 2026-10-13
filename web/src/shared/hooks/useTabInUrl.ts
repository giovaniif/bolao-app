import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useTabInUrl<T extends string>(
  key: string,
  tabs: readonly T[],
  fallback: T
): [T, (tab: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const fromUrl = searchParams.get(key) as T | null;
  const tab = fromUrl && tabs.includes(fromUrl) ? fromUrl : fallback;

  const setTab = useCallback(
    (next: T) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set(key, next);
          return params;
        },
        { replace: true }
      );
    },
    [key, setSearchParams]
  );

  return [tab, setTab];
}
