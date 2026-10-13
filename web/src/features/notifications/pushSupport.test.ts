import { describe, expect, it, vi } from 'vitest';
import { isIOS, readPushStatus, toSubscriptionBody, urlBase64ToUint8Array } from './pushSupport';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36';

interface FakeWindowOptions {
  userAgent?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  push?: boolean;
  permission?: NotificationPermission;
  subscribed?: boolean;
}

function fakeWindow({
  userAgent = ANDROID,
  maxTouchPoints = 5,
  standalone = false,
  push = true,
  permission = 'default',
  subscribed = false,
}: FakeWindowOptions = {}): Window {
  const navigator: Record<string, unknown> = { userAgent, maxTouchPoints };
  if (push) {
    navigator.serviceWorker = {
      getRegistration: vi.fn().mockResolvedValue({
        pushManager: { getSubscription: vi.fn().mockResolvedValue(subscribed ? { endpoint: 'e' } : null) },
      }),
    };
  }
  const win: Record<string, unknown> = {
    navigator,
    matchMedia: () => ({ matches: standalone }),
  };
  if (push) {
    win.PushManager = function PushManager() {};
    win.Notification = { permission };
  }
  return win as unknown as Window;
}

describe('isIOS', () => {
  it.each([
    ['iPhone', IPHONE, 5, true],
    ['iPad, which reports itself as a Mac with touch', IPAD, 5, true],
    ['a Mac without touch is not iOS', IPAD, 0, false],
    ['Android', ANDROID, 5, false],
  ])('%s', (_, userAgent, maxTouchPoints, want) => {
    expect(isIOS({ userAgent, maxTouchPoints } as Navigator)).toBe(want);
  });
});

describe('readPushStatus', () => {
  it('asks iPhone users in a Safari tab to install the app', async () => {
    await expect(readPushStatus(fakeWindow({ userAgent: IPHONE, push: false }))).resolves.toBe('needs-install');
  });

  it('lets an installed iPhone app subscribe', async () => {
    await expect(readPushStatus(fakeWindow({ userAgent: IPHONE, standalone: true }))).resolves.toBe('off');
  });

  it('works on Android in a regular browser tab', async () => {
    await expect(readPushStatus(fakeWindow())).resolves.toBe('off');
  });

  it('reports an existing subscription as on', async () => {
    await expect(readPushStatus(fakeWindow({ subscribed: true }))).resolves.toBe('on');
  });

  it('reports blocked permission', async () => {
    await expect(readPushStatus(fakeWindow({ permission: 'denied' }))).resolves.toBe('denied');
  });

  it('reports browsers without the Push API', async () => {
    await expect(readPushStatus(fakeWindow({ push: false }))).resolves.toBe('unsupported');
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes unpadded url-safe base64', () => {
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([0xfb, 0xff]);
  });
});

describe('toSubscriptionBody', () => {
  it('extracts the endpoint and keys the API expects', () => {
    const sub = {
      endpoint: 'https://push.example/1',
      toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } }),
    } as unknown as PushSubscription;
    expect(toSubscriptionBody(sub)).toEqual({ endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } });
  });
});
