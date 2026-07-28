# Architecture and patterns

Where things live and which layer a change belongs in. Style rules for each layer are in
`.claude/code-style.md`.

## API — `api/`

```
cmd/server/main.go        entrypoint: config → pool → migrations → wiring → routes
cmd/seed-palpites/        one-off seeding utility
internal/config/          environment loading
internal/database/        pgx pool construction
internal/auth/            JWT issuing/parsing, password hashing
internal/handler/         HTTP: parse, validate, authorize, respond
internal/service/         business rules — pure, testable, no DB and no gin
internal/repository/      SQL against pgxpool
internal/models/          structs shared across layers, with JSON tags
internal/constants/       static domain data (team list)
migrations/               numbered .sql, run on startup
```

### Layering

`handler → service → repository`. The arrows only point one way:

- A handler never writes SQL.
- A service never imports `gin` and never touches `*pgxpool.Pool`. Services take
  repositories (or plain data) and return plain data — that is what makes
  `internal/service` the place where the tests live.
- A repository never contains business rules; it maps rows to `models` structs.

Two service shapes coexist, both correct:

- **Pure functions** — `CalculateMatchPoints`, `SummarizeRounds`, `FillMissingPredictions`.
  Prefer this. No dependencies, trivially table-testable.
- **Structs with repository dependencies** — `NewClassificationService(bolaoRepo,
  matchRepo, predictionRepo, partialRepo)`, for orchestration across several repositories.

New scoring or classification logic goes in a pure function, called from wherever needs it.
That is why `scoring.go` has no dependencies: it is the rulebook from `criterios.md`,
expressed as named constants (`PointsExactScoreHigh = 10`) rather than magic numbers.

### Wiring

All construction happens in `cmd/server/main.go`: repositories, then services, then
handlers, then routes. There is no DI container and no global state — adding a dependency
means adding a constructor parameter. Keep it that way; it is what makes handlers
constructible in a test.

### Routes and auth

Three tiers, all wired in `main.go`:

1. **Public** — registered on `r` directly: `POST /api/auth/login`, `GET /api/teams`.
2. **Authenticated** — the `api` group behind `handler.AuthMiddleware(cfg.JWTSecret)`,
   which puts `user_id` (a `uuid.UUID`), `username`, and `is_admin` into the gin context:

   ```go
   userID := c.MustGet("user_id").(uuid.UUID)
   ```

3. **Admin** — a nested `admin := api.Group("")` with `handler.AdminMiddleware()`: writes
   to users, matches, results, and bolões.

Put a new endpoint in the right group rather than checking `is_admin` inside the handler —
the group is the authorization boundary, and a handler that re-checks it hides the rule.

### Multi-tenancy by bolão

A `bolao` is a season. **Every domain row is scoped by `bolao_id`** — matches,
predictions, participants. Handlers resolve it through one helper:

```go
bolaoID, err := resolveBolaoID(c, h.bolaoRepo)   // ?bolao_id= if present, else the active bolão
```

Rules:

- Writes only ever target the **active** bolão. Finished bolões are read-only forever.
- Any new repository method that reads or writes domain data takes `bolaoID uuid.UUID`.
  A query without a `bolao_id` filter is a bug — it leaks another season's data.
- New endpoints returning domain data call `resolveBolaoID`; do not re-implement the
  fallback.

### Migrations

Numbered SQL files, applied in a **hardcoded list** in `runMigrations` on every startup.
Consequences you must respect:

- Adding a migration means adding the filename to that list in `cmd/server/main.go`.
  A file alone does nothing.
- Migrations run on every boot, so they must be **idempotent**: `CREATE TABLE IF NOT
  EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded `DO $$` blocks for constraints.
- Only `001_init.sql` is fatal on failure; later ones log and continue. A non-idempotent
  migration therefore fails quietly in production — write it defensively.
- Never edit a migration that has already run anywhere. Add a new one.

## Web — `web/`

```
src/features/<feature>/
  api/         fetch functions + response interfaces
  hooks/       TanStack Query hooks wrapping those functions
  components/  presentational pieces
  pages/       route-level composition
src/shared/
  api/client.ts        the api<T>() fetch wrapper (auth, errors, 204)
  components/          Button, Input, Layout
  hooks/               useAuth, AuthProvider, useRoundInUrl
  query/queryKeys.ts   every cache key in one place
  utils/               date helpers
src/test/setup.ts      Testing Library setup
```

Features in use: `admin`, `auth`, `boloes`, `champions`, `classification`, `matches`,
`parciais`, `predictions`, `profile`, `viewPredictions`.

### Rules

- **A feature owns its vertical slice.** Cross-feature imports are allowed for types and
  small components (`champions` imports `UserWithStats` from `classification`), but if two
  features need the same behaviour, it moves to `shared/`.
- **The data path is fixed**: `api/*.ts` → `hooks/*.ts` → page → component. A component
  never calls `api<T>()` directly, and a page never calls `fetch`.
- **Every query key comes from `queryKeys.ts`.** Adding a query means adding a key there
  first, so invalidation stays greppable.
- **URL is state.** The selected round lives in `?rodada=N` via `useRoundInUrl`, so links
  and reloads survive and the round persists across tabs. New cross-page selection state
  follows the same pattern rather than lifting into a context.
- `@` is aliased to `src/` in `vitest.config.ts`; relative imports are the norm in existing
  code — either is fine, don't churn them.

### API contract

Go JSON tags are `snake_case` and TypeScript interfaces mirror them exactly
(`home_goals`, `display_name`, `total_points`). There is no mapping layer. When you change
a Go struct's JSON tag, grep `web/src` for the field in the same PR — the compiler will
not catch it for you.

## Domain concepts

| Term | Meaning |
|---|---|
| bolão | One season of the pool. Exactly one is `active`; finished ones are read-only |
| rodada / round | A matchday. Predictions are made per round |
| palpite / prediction | A user's predicted score for a match |
| market (`market_closes_at`) | Deadline after which predictions lock for a match |
| parciais / partials | Live in-progress scores, used for provisional standings |
| classificação | Standings, cumulative or filtered by round |

Two behaviours worth knowing before touching scoring:

- A missing prediction counts as **0×0 once the market closes**; while the market is still
  open it carries a negative sentinel and is skipped (`FillMissingPredictions`,
  `EffectivePredEntry`).
- The round-total-goals bonus is awarded only for a **complete** round, never for partials
  — the predicted total spans the whole round, so comparing it mid-round is meaningless.

`criterios.md` is cited by the README and by `scoring.go` as the specification of the
scoring rules, but **the file is not in the repository** (it exists only in old history).
Until someone restores it, `internal/service/scoring.go` plus `scoring_test.go` are the
authoritative statement of the rules — which is exactly why changing a points constant
without a matching test case is unacceptable here.
