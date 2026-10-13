import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePushSubscription, getPushPublicKey, savePushSubscription } from './pushApi';
import { API_BASE } from '../../../shared/api/client';

const mockFetch = vi.fn();

function respond(status: number, body?: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: status < 400,
    status,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  });
}

describe('pushApi', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('fetches the VAPID public key', async () => {
    respond(200, { public_key: 'BPk' });
    await expect(getPushPublicKey()).resolves.toEqual({ public_key: 'BPk' });
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/push/public-key`, expect.anything());
  });

  it('surfaces the API message when push is disabled', async () => {
    respond(503, { error: 'notificações indisponíveis' });
    await expect(getPushPublicKey()).rejects.toThrow('notificações indisponíveis');
  });

  it('posts the browser subscription', async () => {
    respond(204);
    const sub = { endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } };
    await savePushSubscription(sub);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/push/subscriptions`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(sub) }),
    );
  });

  it('deletes a subscription by endpoint', async () => {
    respond(204);
    await deletePushSubscription('https://push.example/1');
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/push/subscriptions`,
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ endpoint: 'https://push.example/1' }) }),
    );
  });
});
