import type { ErrorEvent } from '@sentry/react-native';

const SECRET_HEADERS = ['authorization', 'cookie'];
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const BEARER = /(bearer\s+)[^\s"']+/gi;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

function hideEmails(text?: string): string | undefined {
  return text?.replace(EMAIL, '[email]').replace(BEARER, '$1[token]').replace(JWT, '[token]');
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const headers = Object.fromEntries(
      Object.entries(event.request.headers ?? {}).filter(([name]) => !SECRET_HEADERS.includes(name.toLowerCase()))
    );
    event.request = { ...event.request, headers, cookies: undefined, data: undefined };
  }
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {};
  }
  event.message = hideEmails(event.message);
  event.breadcrumbs = event.breadcrumbs?.map((b) => ({ ...b, message: hideEmails(b.message) }));
  for (const ex of event.exception?.values ?? []) {
    ex.value = hideEmails(ex.value);
  }
  return event;
}
