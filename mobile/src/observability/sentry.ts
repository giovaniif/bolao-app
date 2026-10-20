import * as Sentry from '@sentry/react-native';
import { scrubEvent } from './scrub';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'dev',
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
