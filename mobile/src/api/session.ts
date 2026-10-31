export const SESSION_EXPIRED = 'Sua sessão expirou. Entre de novo.';
export const ACCOUNT_DELETED = 'Sua conta foi excluída';

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

export type RefreshResult = { kind: 'ok'; token: string } | { kind: 'unauthorized' } | { kind: 'offline' };

interface SessionHandlers {
  onRefreshed: (token: string) => Promise<void> | void;
  onExpired: () => Promise<void> | void;
}

let handlers: SessionHandlers | null = null;
let inflight: Promise<RefreshResult> | null = null;
let expiredFor: string | null = null;
let expiring: Promise<void> = Promise.resolve();
let notice: string | null = null;

export function configureSession(next: SessionHandlers) {
  handlers = next;
}

export function resetSessionState() {
  inflight = null;
  expiredFor = null;
  expiring = Promise.resolve();
  notice = null;
}

export function setLoginNotice(message: string | null) {
  notice = message;
}

export function consumeLoginNotice(): string | null {
  const message = notice;
  notice = null;
  return message;
}

function decodeBase64Url(part: string): string {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
}

export function tokenExpiry(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const payload = JSON.parse(decodeBase64Url(part)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function needsRefresh(token: string, now = Date.now()): boolean {
  const exp = tokenExpiry(token);
  return exp !== null && exp - now < REFRESH_WINDOW_MS;
}

export function isExpired(token: string, now = Date.now()): boolean {
  const exp = tokenExpiry(token);
  return exp !== null && exp + CLOCK_SKEW_MS <= now;
}

export function refreshOnce(run: () => Promise<RefreshResult>): Promise<RefreshResult> {
  if (!inflight) {
    inflight = run()
      .then(async (result) => {
        if (result.kind === 'ok') await handlers?.onRefreshed(result.token);
        return result;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function expireSession(token: string, message = SESSION_EXPIRED): Promise<void> {
  if (expiredFor === token) return expiring;
  expiredFor = token;
  notice = message;
  expiring = Promise.resolve(handlers?.onExpired()).catch(() => undefined);
  return expiring;
}
