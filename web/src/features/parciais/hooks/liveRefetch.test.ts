import { describe, expect, it } from 'vitest';
import { LIVE_REFETCH_MS, liveRefetchInterval } from './liveRefetch';
import type { MatchWithPartial } from '../api/parciaisApi';

const match = (status: string): MatchWithPartial => ({ id: status, home_team: 'Bahia', away_team: 'Santos', status });

describe('liveRefetchInterval', () => {
  it('refetches every minute while a match of the round is live', () => {
    expect(liveRefetchInterval([match('finished'), match('live')])).toBe(LIVE_REFETCH_MS);
    expect(LIVE_REFETCH_MS).toBe(60_000);
  });

  it('does not refetch when no match is live', () => {
    expect(liveRefetchInterval([match('finished'), match('timed')])).toBe(false);
  });

  it('does not refetch before the partials load', () => {
    expect(liveRefetchInterval(undefined)).toBe(false);
  });
});
