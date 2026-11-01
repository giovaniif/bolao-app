import * as Sentry from '@sentry/react-native';
import { reportingAllowed } from './reporting';
import { scrubEvent } from './scrub';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn || !reportingAllowed()) return;
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
