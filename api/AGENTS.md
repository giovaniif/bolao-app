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
internal/push/         Web Push sender (VAPID)
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
- A new endpoint that returns domain data calls `resolveBolaoID(c, h.bolaoRepo)` (`?bolao_id=` or the active one). Do not write the fallback again.

## Migrations

See [ADR 0004](../docs/adr/0004-startup-migrations.md).

- Numbered SQL files, applied from a **hardcoded list** in `runMigrations` on every start. A new file must also go in that list.
- They run on every boot, so make them idempotent: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded `DO $$` blocks.
- Only `001_init.sql` is fatal on failure. Later ones log and continue, so a non-idempotent migration fails quietly in production.
- Never edit a migration that ran anywhere. Add a new one.

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
