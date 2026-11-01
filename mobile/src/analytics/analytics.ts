import * as SecureStore from 'expo-secure-store';
import PostHog from 'posthog-react-native';
import { reportingAllowed } from '../observability/reporting';

export type Consent = 'granted' | 'denied';

const CONSENT_KEY = 'analytics-consent';
const KEY = reportingAllowed() ? process.env.EXPO_PUBLIC_POSTHOG_KEY : undefined;

let client: PostHog | null = null;
let consent: Consent | null = null;

async function readConsent(): Promise<Consent | null> {
  const value = await SecureStore.getItemAsync(CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

export async function needsConsent(): Promise<boolean> {
  return !!KEY && (await readConsent()) === null;
}

export async function startAnalytics(): Promise<void> {
  if (!KEY || client) return;
  client = new PostHog(KEY, {
    host: 'https://us.i.posthog.com',
    defaultOptIn: false,
    captureAppLifecycleEvents: false,
    enableSessionReplay: false,
    disableSurveys: true,
    preloadFeatureFlags: false,
    sendFeatureFlagEvent: false,
    disableRemoteConfig: true,
    personProfiles: 'identified_only',
    errorTracking: { autocapture: { uncaughtExceptions: false, unhandledRejections: false, console: false } },
  });
  consent = await readConsent();
  if (consent === 'granted') {
    await client.optIn();
  }
}

export async function setConsent(next: Consent): Promise<void> {
  consent = next;
  await SecureStore.setItemAsync(CONSENT_KEY, next);
  if (next === 'granted') await client?.optIn();
  else await client?.optOut();
}

export function track(event: string, properties?: Record<string, string | number | boolean>) {
  if (client && consent === 'granted') {
    client.capture(event, properties);
  }
}

export function identify(userId: string) {
  if (client && consent === 'granted') {
    client.identify(userId);
  }
}

export function resetAnalytics() {
  client?.reset();
}

export const analyticsEnabled = !!KEY;

export async function hasConsent(): Promise<boolean> {
  return (await readConsent()) === 'granted';
}
