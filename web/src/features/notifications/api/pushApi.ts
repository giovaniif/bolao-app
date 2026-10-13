import { api } from '../../../shared/api/client';

export interface PushPublicKeyResponse {
  public_key: string;
}

export interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function getPushPublicKey() {
  return api<PushPublicKeyResponse>('/push/public-key');
}

export function savePushSubscription(subscription: PushSubscriptionBody) {
  return api<void>('/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify(subscription),
  });
}

export function deletePushSubscription(endpoint: string) {
  return api<void>('/push/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
}
