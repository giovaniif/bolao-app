import type { PostHog } from 'posthog-js';

export type Consent = 'granted' | 'denied';

const CONSENT_KEY = 'analytics-consent';
let client: PostHog | null = null;

function readConsent(): Consent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function needsConsent(key: string | undefined): boolean {
  return !!key && readConsent() === null;
}

export async function startAnalytics(key: string | undefined): Promise<void> {
  if (!key || client) return;
  const { default: posthog } = await import('posthog-js');
  posthog.init(key, {
    api_host: 'https://eu.i.posthog.com',
    opt_out_capturing_by_default: true,
    persistence: 'localStorage',
    autocapture: false,
    capture_pageview: true,
    disable_session_recording: true,
  });
  client = posthog;
  if (readConsent() === 'granted') {
    posthog.opt_in_capturing();
  }
}

export function setConsent(consent: Consent) {
  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    return;
  } finally {
    if (consent === 'granted') client?.opt_in_capturing();
    else client?.opt_out_capturing();
  }
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (client && readConsent() === 'granted') {
    client.capture(event, properties);
  }
}

export function identify(userId: string) {
  if (client && readConsent() === 'granted') {
    client.identify(userId);
  }
}

export function resetAnalytics() {
  client?.reset();
}
