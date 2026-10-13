import { describe, expect, it, vi } from 'vitest';
import { openNotificationTarget, parsePushPayload, toNotification } from './push';

const origin = 'https://bolao.example';

function client(url: string) {
  return { url, focus: vi.fn().mockResolvedValue(undefined), navigate: vi.fn().mockResolvedValue(undefined) };
}

describe('parsePushPayload', () => {
  it('keeps a well-formed payload from the API', () => {
    const payload = { title: 'Rodada 7 aberta', body: 'Palpites até dom', url: '/palpites?rodada=7', tag: 'rodada-7' };
    expect(parsePushPayload(payload)).toEqual(payload);
  });

  it('falls back to a generic notice for malformed data', () => {
    expect(parsePushPayload(null).title).toBe('Bolão');
    expect(parsePushPayload({ title: 1 }).url).toBe('/');
  });
});

describe('toNotification', () => {
  it('carries the target url and collapses by round tag', () => {
    const { title, options } = toNotification({ title: 'Rodada 7', body: 'b', url: '/palpites?rodada=7', tag: 'rodada-7' });
    expect(title).toBe('Rodada 7');
    expect(options.tag).toBe('rodada-7');
    expect(options.data).toEqual({ url: '/palpites?rodada=7' });
  });
});

describe('openNotificationTarget', () => {
  it('navigates and focuses an open app tab', async () => {
    const tab = client(`${origin}/classificacao`);
    const openWindow = vi.fn();
    await openNotificationTarget({ url: '/palpites?rodada=7' }, origin, [tab], openWindow);
    expect(tab.navigate).toHaveBeenCalledWith(`${origin}/palpites?rodada=7`);
    expect(tab.focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens a window when no app tab is open', async () => {
    const openWindow = vi.fn().mockResolvedValue(null);
    await openNotificationTarget({ url: '/palpites?rodada=7' }, origin, [client('https://other.example/')], openWindow);
    expect(openWindow).toHaveBeenCalledWith(`${origin}/palpites?rodada=7`);
  });

  it('opens the home page when the notification has no url', async () => {
    const openWindow = vi.fn().mockResolvedValue(null);
    await openNotificationTarget(undefined, origin, [], openWindow);
    expect(openWindow).toHaveBeenCalledWith(`${origin}/`);
  });
});
