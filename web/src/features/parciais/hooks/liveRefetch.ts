import type { MatchWithPartial } from '../api/parciaisApi';

export const LIVE_REFETCH_MS = 60_000;

export function liveRefetchInterval(matches: MatchWithPartial[] | undefined): number | false {
  return matches?.some((m) => m.status === 'live') ? LIVE_REFETCH_MS : false;
}
