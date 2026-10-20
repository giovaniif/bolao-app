# ADR 0015: Matches come from football-data.org

Status: accepted, 2026-10-20.

## Decision

- Matches belong to a competition season (`competitions`), not to one bolão. Every bolão on that competition shares its matches and results.
- The first competitions are Brasileirão Série A (`BSA`) and the Champions League (`CL`).
- A sync job fills fixtures, kickoff times and final scores from the football-data.org free plan.
- The database is the cache. Clients never call the provider. Only the sync job calls it.
- The sync job runs from the pg_cron tick. It syncs fixtures once a day, and results only while a match is live or waits for its final score.
- The client limits itself to 6 calls a minute and reads `x-requests-available-minute` and `X-RequestCounter-Reset`.
- A match locks at its kickoff. Only a `TIMED` match (confirmed kickoff time) locks.
- The platform admin can correct a match and lock it against the next sync. Owners do not edit matches.

## Why

- Owners do not type rounds and results. One correct copy of each result serves every bolão.
- The free plan covers both competitions. One call returns a full season, so two competitions use about 75 calls a day.
- The free plan gives delayed scores. The bolão needs only final scores, so the delay is acceptable.

## Consequences

- A spike on 2026-10-20 found results up to four hours late. The sync keeps polling a match until it is `FINISHED`.
- Champions League knockout matches appear mid-season. The sync accepts new matches at any time.
- API-Football free does not cover the current season. There is no backup provider yet (issue #65).
- Live partials stay manual. Automatic partials need the paid livescores plan (issue #43).
- Ask football-data.org about commercial use before the public launch.
