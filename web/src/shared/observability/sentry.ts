import * as Sentry from '@sentry/react';
import { scrubEvent } from './scrub';

export function initSentry(dsn: string) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE,
    beforeSend: scrubEvent,
  });
}
