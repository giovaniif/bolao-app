import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePushSubscription } from './usePushSubscription';
import * as pushApi from '../api/pushApi';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

let currentSubscription: { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> } | null;
const subscribe = vi.fn();
const requestPermission = vi.fn();

beforeEach(() => {
  currentSubscription = null;
  subscribe.mockReset();
  requestPermission.mockReset();
  const pushManager = {
    getSubscription: vi.fn(async () => currentSubscription),
    subscribe: subscribe.mockImplementation(async () => {
      currentSubscription = {
        endpoint: 'https://push.example/1',
        toJSON: () => ({ keys: { p256dh: 'k', auth: 'a' } }),
        unsubscribe: vi.fn(async () => {
          currentSubscription = null;
          return true;
        }),
      };
      return currentSubscription;
    }),
  };
  const registration = { pushManager };
  vi.stubGlobal('PushManager', function PushManager() {});
  vi.stubGlobal('Notification', { permission: 'default', requestPermission });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registration), getRegistration: vi.fn(async () => registration) },
  });
  vi.spyOn(pushApi, 'getPushPublicKey').mockResolvedValue({ public_key: '-_8' });
  vi.spyOn(pushApi, 'savePushSubscription').mockResolvedValue(undefined);
  vi.spyOn(pushApi, 'deletePushSubscription').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('usePushSubscription', () => {
  it('subscribes and registers the subscription with the API', async () => {
    requestPermission.mockResolvedValue('granted');
    const { result } = renderHook(() => usePushSubscription(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('off'));

    act(() => result.current.enable());

    await waitFor(() => expect(result.current.status).toBe('on'));
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(pushApi.savePushSubscription).toHaveBeenCalledWith({
      endpoint: 'https://push.example/1',
      keys: { p256dh: 'k', auth: 'a' },
    });
  });

  it('reports a refused permission without subscribing', async () => {
    requestPermission.mockResolvedValue('denied');
    const { result } = renderHook(() => usePushSubscription(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('off'));

    act(() => result.current.enable());

    await waitFor(() => expect(result.current.error?.message).toBe('Permissão de notificação negada'));
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes and removes the subscription from the API', async () => {
    requestPermission.mockResolvedValue('granted');
    const { result } = renderHook(() => usePushSubscription(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('off'));
    act(() => result.current.enable());
    await waitFor(() => expect(result.current.status).toBe('on'));

    act(() => result.current.disable());

    await waitFor(() => expect(result.current.status).toBe('off'));
    expect(pushApi.deletePushSubscription).toHaveBeenCalledWith('https://push.example/1');
  });
});
