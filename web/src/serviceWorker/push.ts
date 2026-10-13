export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

interface NotificationContent {
  title: string;
  options: NotificationOptions;
}

const FALLBACK: PushPayload = { title: 'Bolão', body: 'Tem novidade no bolão.', url: '/' };

function isPushPayload(value: unknown): value is PushPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.title === 'string' && typeof v.body === 'string' && typeof v.url === 'string';
}

export function parsePushPayload(raw: unknown): PushPayload {
  return isPushPayload(raw) ? raw : FALLBACK;
}

export function toNotification(payload: PushPayload): NotificationContent {
  return {
    title: payload.title,
    options: {
      body: payload.body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: payload.tag,
      data: { url: payload.url },
    },
  };
}

interface FocusableClient {
  url: string;
  focus(): Promise<unknown>;
  navigate(url: string): Promise<unknown>;
}

// Reuses an open tab of the app instead of stacking new windows on every tap.
export async function openNotificationTarget(
  data: unknown,
  origin: string,
  clients: readonly FocusableClient[],
  openWindow: (url: string) => Promise<unknown>,
): Promise<void> {
  const path =
    typeof data === 'object' && data !== null && typeof (data as { url?: unknown }).url === 'string'
      ? (data as { url: string }).url
      : '/';
  const target = new URL(path, origin).href;
  const client = clients.find((c) => new URL(c.url).origin === origin);
  if (client) {
    await client.navigate(target);
    await client.focus();
    return;
  }
  await openWindow(target);
}
