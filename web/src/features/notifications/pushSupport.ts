import type { PushSubscriptionBody } from './api/pushApi';

export type PushStatus = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

export function isIOS(nav: Navigator = navigator): boolean {
  // iPadOS reports itself as a Mac; touch support is what tells them apart.
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
}

export function isStandalone(win: Window = window): boolean {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  return win.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

export function isPushSupported(win: Window = window): boolean {
  return 'serviceWorker' in win.navigator && 'PushManager' in win && 'Notification' in win;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function toSubscriptionBody(sub: PushSubscription): PushSubscriptionBody {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
  };
}

// iOS only exposes Web Push to a Home Screen app, so a Safari tab must be told to install first.
export async function readPushStatus(win: Window = window): Promise<PushStatus> {
  if (isIOS(win.navigator) && !isStandalone(win)) return 'needs-install';
  if (!isPushSupported(win)) return 'unsupported';
  if ((win as Window & typeof globalThis).Notification.permission === 'denied') return 'denied';
  const registration = await win.navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? 'on' : 'off';
}
