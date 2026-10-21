import { api } from './client';

export type PushPlatform = 'ios' | 'android';

export function registerExpoToken(token: string, platform: PushPlatform) {
  return api<null>('/push/expo-tokens', { method: 'POST', body: JSON.stringify({ token, platform }) });
}

export function unregisterExpoToken(token: string) {
  return api<null>('/push/expo-tokens', { method: 'DELETE', body: JSON.stringify({ token }) });
}
