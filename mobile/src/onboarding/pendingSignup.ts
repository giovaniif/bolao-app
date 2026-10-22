import type { SocialProvider } from '../api/auth';

export interface PendingSignup {
  provider: SocialProvider;
  idToken: string;
  suggestedUsername: string;
  name?: string;
  next: string;
}

let pending: PendingSignup | null = null;

export function setPendingSignup(next: PendingSignup | null) {
  pending = next;
}

export function getPendingSignup(): PendingSignup | null {
  return pending;
}
