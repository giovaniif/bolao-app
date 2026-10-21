# ADR 0016: TheSportsDB is the backup feed for results

Status: accepted, 2026-10-21.

## Decision

- football-data.org stays the primary feed ([ADR 0015](0015-matches-from-football-data.md)). It is the only source of fixtures, kickoff times, rounds and match ids.
- TheSportsDB is the backup feed. The sync uses it only for results, and only when the primary call fails: a network error, a 429 or a 5xx.
- The backup is on when `THESPORTSDB_API_KEY` is set. The free key `123` is enough. Without the variable, the sync uses only the primary feed.
- The fallback feed keeps the last good primary list of each competition season in memory. When the primary fails, it asks TheSportsDB for the matches of each UTC day that has an open match in the last 24 hours. It copies the status and the final score onto the known match.
- A backup match is the same match as a known match when both are in the same competition, both kick off on the same UTC day, and the home team or the away team has the same normalized name. A team plays at most once a day, so one team is enough.
- When the cache is empty (for example after a restart) and the primary fails, the sync fails as before and tries again on the next tick.

## Why

We compared the providers on 2026-10-21:

| Provider | BSA and CL, current season | Free limit | Paid | Notes |
|---|---|---|---|---|
| API-Football (api-sports.io) | No on the free plan (2022 to 2024 only) | 100 calls a day | from about USD 19 a month | Good data, but the free plan is not useful now |
| TheSportsDB | Yes: league `4351` (Brazilian Serie A) and `4480` (Champions League). A test call returned the 2026-10-18 BSA results | Free key `123`, about 30 calls a minute | Patreon, about USD 9 a month, adds livescores | Community data. Scores can arrive some minutes late |
| Sportmonks | No on the free plan (Danish and Scottish leagues only) | 180 calls an hour per entity | from about EUR 29 a month | Too expensive for this app |
| ESPN site API | Yes (`bra.1`, `uefa.champions`) | No key, no stated limit | None | Not documented, and no terms for third-party use. It can change without notice |
| OpenLigaDB | No (mostly German leagues) | Free | None | Does not cover BSA |

- TheSportsDB is the only free option with an API key, published terms and both competitions in the current season.
- Results are the part that must not stop. A missing result blocks the classification of every bolão. Fixtures change slowly, and the daily fixtures sync can wait for the primary.
- Matching by date and team name avoids a table that maps the match ids of two providers.

## Consequences

- The fallback cannot add new matches. A new fixture waits for the primary feed.
- A team name that differs between the providers needs an entry in the alias table of the fallback feed. A match without a name match stays as the primary last reported it.
- Backup calls happen only after a primary failure and cover at most two days, so they do not count in the daily call budget.
- TheSportsDB data is community-edited. The next good primary sync, or the platform admin, corrects a wrong score from the backup.
- Check the TheSportsDB terms and buy the Patreon key before the public launch, as for football-data.org.
