import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps a tab selection in the URL so links and the back button work.
 *
 * Unlike useRoundInUrl this never writes on mount: setSearchParams calls navigate
 * synchronously against the current render's params, so two hooks writing in the same tick
 * overwrite each other. The round stays the only hook that corrects the URL by itself.
 */
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
