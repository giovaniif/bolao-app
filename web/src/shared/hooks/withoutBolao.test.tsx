import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMyPredictions } from '../../features/predictions/hooks/usePredictions';
import { useMatchesByRound, useRounds } from '../../features/matches/hooks/useMatches';
import { useClassification } from '../../features/classification/hooks/useClassification';
import { usePartialsByRound, usePartialClassification } from '../../features/parciais/hooks/usePartiais';
import { useUsers, usePredictionsByUser } from '../../features/viewPredictions/hooks/useViewPredictions';

vi.mock('./useCurrentBolao', () => ({
  useCurrentBolao: () => ({ bolaoId: undefined, bolao: undefined, boloes: [], isLoading: false, select: vi.fn() }),
}));

const mockFetch = vi.fn();

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('[]') });
  vi.stubGlobal('fetch', mockFetch);
});

describe('without a current bolão', () => {
  it('asks the API for nothing', async () => {
    renderHook(
      () => {
        useMyPredictions(7);
        useMatchesByRound(7);
        useRounds();
        useClassification(7);
        usePartialsByRound(7);
        usePartialClassification(7);
        useUsers();
        usePredictionsByUser(7, 'u-1');
      },
      { wrapper }
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
