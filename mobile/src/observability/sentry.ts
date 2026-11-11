import * as Sentry from '@sentry/react-native';
import { reportingAllowed } from './reporting';
import { scrubEvent } from './scrub';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry(allowed: () => boolean = reportingAllowed) {
  if (!allowed()) return;
  if (!dsn) {
    console.warn('[sentry] EXPO_PUBLIC_SENTRY_DSN is not set; Sentry is disabled. Use the bolao-mobile project DSN.');
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'dev',
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}
