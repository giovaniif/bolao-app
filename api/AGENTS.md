# api

The Go API: Gin, pgx/v5 and PostgreSQL. The repo-wide rules in the [root AGENTS.md](../AGENTS.md) also apply here.

## Commands

```bash
gofmt -l .                 # must print nothing; fix with gofmt -w .
go vet ./...
golangci-lint run ./...    # must print "0 issues."
go test ./... -short       # what CI runs; DB tests skip
go test ./... -short -cover
```

- `golangci-lint` uses `.golangci.yml` (v2, Go 1.23): `errcheck`, `staticcheck`, `ineffassign`, `unused`, `govet`. CI pins linter `v2.12.2`.
- Run locally: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/bolao?sslmode=disable JWT_SECRET=x go run ./cmd/server`. Migrations run on start.
- Repository tests need a live PostgreSQL. Set `TEST_DATABASE_URL` or use `localhost:5432/bolao_test`.

## Layout

```
cmd/server/main.go     config → pool → migrations → wiring → routes
cmd/seed-palpites/     one-off seeding utility
internal/config/       environment loading
internal/database/     pgx pool
internal/auth/         JWT and password hashing
internal/handler/      HTTP: parse, validate, authorize, respond
internal/service/      business rules: pure, no DB, no gin
internal/repository/   SQL against pgxpool
internal/push/         Web Push sender (VAPID) and Expo push sender
internal/models/       structs shared across layers, with JSON tags
internal/constants/    static domain data (team list)
migrations/            numbered .sql, run on start
```

## Layering

`handler → service → repository`. The arrows point one way only ([ADR 0002](../docs/adr/0002-layering.md)).

- A handler never writes SQL.
- A service never imports `gin` and never touches `*pgxpool.Pool`. It takes repositories (or interfaces of them) or plain data, and returns plain data.
- A repository never holds business rules. It maps rows to `models` structs.
- Prefer pure service functions (`CalculateMatchPoints`, `SummarizeRounds`, `DueReminders`). Use a struct with repository dependencies only to orchestrate several repositories (`NewClassificationService`).
- New scoring or classification logic goes in a pure function. `scoring.go` is the rulebook from [SCORING.md](../SCORING.md), as named constants (`PointsExactScoreHigh = 10`), not magic numbers.

## Wiring and routes

- All construction is in `cmd/server/main.go`: repositories, then services, then handlers, then routes. There is no DI container and no global state. A new dependency is a new constructor parameter, which keeps handlers constructible in tests.
- Three route tiers:
  1. Public, on `r`: `POST /api/auth/login`, `GET /api/teams`, `GET /api/push/public-key`, the cron tick.
  2. Authenticated, the `api` group behind `handler.AuthMiddleware(cfg.JWTSecret)`. It sets `user_id` (`uuid.UUID`), `username` and `is_admin`: `c.MustGet("user_id").(uuid.UUID)`.
  3. Admin, `admin := api.Group("")` with `handler.AdminMiddleware()`.
- Put an endpoint in the right group. Do not check `is_admin` in a handler: the group is the authorization boundary.

## Multi-tenancy by bolão

See [ADR 0003](../docs/adr/0003-multi-tenancy-by-bolao.md).

- Writes go only to the **active** bolão. Finished bolões are read-only forever.
- A new repository method that reads or writes domain data takes `bolaoID uuid.UUID`.
- A new endpoint that returns domain data goes under `/boloes/:id` behind `RequireMember` and calls `resolveBolaoID(c, h.bolaoRepo)`. Do not add unscoped routes that act on the active bolão (issue #88 removed them).

## Migrations

See [ADR 0004](../docs/adr/0004-startup-migrations.md).

- Numbered SQL files, applied from a **hardcoded list** in `runMigrations` on every start. A new file must also go in that list.
- They run on every boot, so make them idempotent: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded `DO $$` blocks.
- Only `001_init.sql` is fatal on failure. Later ones log and continue, so a non-idempotent migration fails quietly in production.
- Never edit a migration that ran anywhere. Add a new one.
- Every table in `public` has row level security on, with no policies (migration 017, issue #44). This blocks the Supabase REST API (`anon`, `authenticated`). The API connects as `postgres`, which owns the tables and has `BYPASSRLS`, so it keeps full access. Never use `FORCE ROW LEVEL SECURITY`.
- Migration 017 runs on every boot and enables RLS on each table in `public`, so a table from a later migration gets RLS on the next start. To close that gap, a migration that creates a table also runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on it.

## Behavior notes

These rules have no unit test, because they live in handlers or SQL that need a database. Keep them when you edit the code.

- `resolveBolaoID` takes the bolão of the `/boloes/:id` route. On the two unscoped reads that stay (`GET /classification` and `GET /matches/rounds/summary`, for the Hall of Champions), it reads `?bolao_id=` for a readable bolão. Without one of them it returns an error and the handler answers 400.
- `assertMatchInActiveBolao` returns 403 for a match of a finished bolão. It stops a stale client that edits a match by id.
- A user can read another user's predictions for a round only after every market in the round closed.
- The finish-bolão body (`POST /boloes/:id/finish`) is optional. No body means `force=false`. `Finish` then refuses with `ErrUnresolvedMatches` while a match has no result.
- `Finish` counts every match without a result (`UnresolvedMatches`). `PendingResults` counts only matches whose market closed. Both are correct.
- Classification `round`: `1`..`998` is that round only. `0` or `999` is cumulative up to the last round that exists.
- Classification loads the whole bolão in three queries (`ListAllByBolao`, `GetAllForBolao`), not one query per round.
- A partial score of `NULL` means "not entered" and does not count. An explicit 0×0 partial counts (migration 005).
- The match sync writes the score of an `IN_PLAY` or `PAUSED` match into `match_partials` with `updated_by` `NULL`. It overwrites only a partial that the sync set or that is empty. A partial that a user entered stays. Live matches sync at most every 5 minutes (`resultsSyncInterval`), inside the daily call budget.
- `FlexibleTime` accepts RFC3339 with a time zone and stores the time in UTC.
- One bolão is active at a time. A unique partial index backs the app check, and `Create` returns `ErrActiveBolaoExists` when it loses the race.
- Creating a bolão enrolls every user (`EnrollAllUsers`, `amount_paid` 0). A user created mid-season is enrolled with `AddParticipant`.
- New users get the bcrypt hash of `123` as password (`auth/password.go`, migration 004). They change it on first login.
- Migration 006 wraps the data that existed before bolões in one bolão, once. It moves `users.amount_paid` to `bolao_participants`, guarded by `information_schema`.
- `cmd/seed-palpites` reads `palpites.md`: a username line, then one `HxA` line per match. It skips `Home x Away` lines. The match order comes from `round1MatchIDs`.

### Push

- `NewPushHandler` with a nil notifier means no push at all: Subscribe and the Expo token endpoints return 503, and the tick does nothing. Without VAPID keys only Web Push is off: Subscribe returns 503, but Expo tokens and the tick still work.
- A reminder goes to Web Push and Expo together. `ClaimUserNotification` claims it per user, per scope (`AudienceOf`: the competition, or the bolão when it has none), per round, kind and deadline (migration 014). So a user in several bolões of one competition gets one reminder per deadline on all devices.
- The tick covers every active bolão (`ListActive`). An Expo token that answers `DeviceNotRegistered` is deleted, as a Web Push endpoint that answers 404 or 410 is.
- Supabase `pg_cron` calls the tick every minute (see [docs/development.md](../docs/development.md#push-reminders--supabase-pg_cron)).
- `AnnounceRound` sends in the background, so the admin request does not wait. It does nothing until the round has a deadline.
- `Upsert` moves a known endpoint to the new user. A browser that logs in as someone else stops notifying the previous user.
- `ClaimNotification` races concurrent ticks on the primary key, so exactly one sends. The key holds `closes_at`, so a moved deadline re-arms the reminders (migration 007). A new-round notice keys on the Unix epoch instead, so it is sent once.
- A reminder stays due for its whole window, so a missed tick does not lose it. A day-before reminder later than one hour is skipped.

### Password reset

- `POST /api/auth/forgot-password` always returns 204, so a caller cannot find out which logins exist. The login is a username or an email.
- Only the SHA-256 of the token is stored. A token is valid for 1 hour and for one use. A reset marks every open token of the user as used.
- A second request for the same user within 60 seconds sends nothing.
- Without `RESEND_API_KEY` the mailer is nil, and a request does nothing.

## Go conventions

- Constructors: `NewXRepository(pool)` and `NewXHandler(deps...)`, returning a pointer. Dependencies are struct fields.
- Every repository method takes `ctx context.Context` first. Handlers pass `c.Request.Context()`.
- SQL is a raw string with `$1` placeholders. Never build SQL from input.
- Return errors up. Do not log and continue. Handlers choose the status code.
- `defer rows.Close()` after every `Query`, and return `rows.Err()` after the loop.
- Nullable columns map to pointer fields (`*int`, `*time.Time`) with `json:",omitempty"`.
- Secrets never go in a serialized struct: `PasswordHash string \`json:"-"\``.
- When you change a JSON tag, grep `web/src` for the field in the same PR. The compiler does not catch it.

## Tests

`internal/service` is the priority: pure functions that hold the scoring, classification, round and reminder rules. Every rule in [SCORING.md](../SCORING.md) needs a test case here, and every scoring test needs a line in SCORING.md.

- Table-driven tests, one case per rule and per edge. Case names state the rule in plain language (see `round_test.go`).
- Small local builders (`played(round)`, `scheduled(round)`) instead of repeated literal structs.
- Failure messages carry the case name and both values: `got = X, want Y`.
- `t.Errorf` to keep checking other cases. `t.Fatalf` only when the next checks mean nothing.
- A scoring change needs a case per points constant it touches, plus the boundaries: a 4+ goal match, an exact draw, a round with a missing prediction.
- Repository tests need a database and start with `if testing.Short() { t.Skip("requires a database") }`. Keep them on SQL that logic depends on: filters, ordering, joins.
- Handlers stay thin. Test status codes for bad input, authorization branches and the JSON shape, with in-memory fakes of their interfaces (see `push_handler_test.go`).
- Do not test framework behavior, getters or mocks that call mocks.

Coverage per package (`go test ./... -short -cover`) never goes down. `internal/handler`, `internal/auth` and `internal/config` started at 0%; new code there arrives with tests.
