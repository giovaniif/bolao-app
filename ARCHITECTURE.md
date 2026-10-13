# Architecture

## Stack

See [ADR 0001](docs/adr/0001-go-api-and-react-pwa.md) and [ADR 0005](docs/adr/0005-hosting.md).

| Area | Stack | Path | Hosting |
|---|---|---|---|
| API | Go 1.23, Gin, pgx/v5 | `api/` | Render (Docker, free plan) |
| Web | React 19, TypeScript, Vite, TanStack Query, Tailwind v4, PWA | `web/` | Vercel |
| DB | PostgreSQL | `api/migrations/` | Supabase (`pg_cron`, `pg_net`) |
| CI/CD | GitHub Actions | `.github/workflows/` | |

Layer detail: [api/AGENTS.md](api/AGENTS.md) and [web/AGENTS.md](web/AGENTS.md).

## Domain

| Term | Meaning |
|---|---|
| bolão | One season of the pool. Exactly one is `active`. Finished ones are read-only |
| round (rodada) | A matchday. Players predict per round |
| prediction (palpite) | A user's predicted score for a match |
| market (`market_closes_at`) | The deadline after which predictions for a match lock. A round closes at the earliest market close of its matches |
| partials (parciais) | Live in-progress scores, used for provisional standings |
| classification (classificação) | Standings, cumulative or for one round |

Two behaviors to know before you touch scoring. [SCORING.md](SCORING.md) is the specification.

- A missing prediction counts as **0×0 once the market closes**. While the market is open, it carries a negative sentinel and is skipped (`FillMissingPredictions`, `EffectivePredEntry`).
- The round-total-goals bonus applies only to a **complete** round, never to partials. The predicted total spans the whole round, so a comparison mid-round means nothing.

## Multi-tenancy

Every domain row (matches, predictions, participants) has a `bolao_id`. Writes go only to the active bolão. A query without a `bolao_id` filter is a bug, because it leaks another season's data. See [api/AGENTS.md](api/AGENTS.md#multi-tenancy-by-bolão).

## Data flow

1. The web calls the API through `api<T>()` in `web/src/shared/api/client.ts`, with a JWT in `Authorization`.
2. Gin routes the request in three tiers: public, authenticated (`AuthMiddleware`) and admin (`AdminMiddleware`).
3. A handler validates the input, calls a service or a repository, and responds. Go JSON tags are `snake_case`, and the TypeScript interfaces mirror them with no mapping layer.

## Push notifications

See [ADR 0006](docs/adr/0006-web-push-via-pg-cron.md).

- The web is an installable PWA. Its service worker (`web/src/sw.ts`) shows Web Push messages.
- The API stores subscriptions and sends three reminders per round: new round, 1 day before close and 10 minutes before close. `notification_log` makes each one send at most once.
- Render's free plan sleeps when idle, so Supabase `pg_cron` calls `POST /api/internal/notifications/tick` every minute with `X-Cron-Secret`. The setup SQL is in [README.md](README.md).
- iOS delivers push only to the app installed on the Home Screen.

## Environments

| | API | Web | DB | Deploys on |
|---|---|---|---|---|
| dev | `bolao-app-dev` | Vercel dev alias | Supabase `bolao-dev` | merge to `main` |
| prod | `bolao-app` | Vercel production | Supabase `bolao` | `v*` tag |
