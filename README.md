# Bolão Brasileirão

Prediction pool management app for the Brazilian football championship.

## Stack

- **Frontend**: React + TypeScript + Tailwind + Vite
- **Backend**: Go + Gin + PostgreSQL
- **Infra**: Docker Compose (dev), Render (API), Vercel (frontend), Supabase (database), GitHub Actions (CI/CD)

## Local development

Run each service individually:

### 1. Database

```bash
docker compose up db -d
```

Starts PostgreSQL on `localhost:5432` (user `postgres`, password `postgres`, database `bolao`).

### 2. API

```bash
cd api
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bolao?sslmode=disable \
JWT_SECRET=any-secret \
go run ./cmd/server
```

API available at http://localhost:3333. Migrations run automatically on startup.

### 3. Frontend

```bash
cd web
npm run dev
```

Frontend available at http://localhost:5173. The dev server proxies `/api` to
`http://localhost:3333` by default; set `VITE_API_URL` to point it elsewhere.

## CI

Build and test run as separate actions per area, each only triggering when files in that area
change (`api/**` or `web/**`):

- **`.github/workflows/backend-ci.yml`**: `build` job (`go build`) and `test` job (`go vet` + `go test -short`,
  no migrations — the DB-backed integration test already skips itself in `-short` mode).
- **`.github/workflows/frontend-ci.yml`**: `build` job (`npm run build`) and `test` job (`npm test`).

## CD — dev (staging) and production environments

Same Dockerfile/build used in production; what changes between environments is environment
variables and the deploy trigger — there's no separate Dockerfile or docker-compose for "dev".

- **Push to `main`** → deploy to the **dev** (staging) environment: `bolao-api-dev` on Render + a
  "dev" deployment on Vercel, pointing at a Supabase dev database separate from production.
- **Release tag** (`v*`) → deploy to **production**: `bolao-api` on Render + production
  deployment on Vercel, pointing at production Supabase.

See `.github/workflows/deploy.yml`.

## Production deploy

### Database – Supabase

The database runs on Supabase (managed PostgreSQL). Migrations run automatically on API startup.
Use the **session pooler** URL (IPv4) to avoid connectivity issues.

### API – Render

The API is deployed on Render via Docker (`render.yaml` at the project root).

Required environment variables on Render:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase session pooler URL |
| `JWT_SECRET` | Secure random string (e.g. `openssl rand -hex 32`) |
| `PORT` | `8080` (already set in `render.yaml`) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push key pair, one per environment (see below) |
| `VAPID_SUBJECT` | Contact for push services, e.g. `mailto:you@example.com` |
| `CRON_SECRET` | Secure random string, shared with the Supabase cron job |

Push notifications stay disabled (and the API logs it) until all three `VAPID_*` variables
are set. Generate a key pair with:

```bash
npx web-push generate-vapid-keys
```

### Push reminders – Supabase pg_cron

Render's free plan sleeps when idle, so the API cannot keep its own timer. Supabase calls
the tick endpoint every minute instead (which also wakes the API). It sends the "1 day
before" and "10 minutes before" reminders; "new round" is sent when an admin creates the
round's matches or sets its close time. Run once per Supabase project, after enabling the
`pg_cron` and `pg_net` extensions (Database → Extensions):

```sql
select cron.schedule(
  'bolao-push-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<render-api-host>/api/internal/notifications/tick',
    headers := jsonb_build_object('X-Cron-Secret', '<CRON_SECRET>'),
    timeout_milliseconds := 60000
  );
  $$
);
```

Inspect recent runs with `select * from net._http_response order by created desc limit 10;`
and remove the job with `select cron.unschedule('bolao-push-tick');`.

### Frontend – Vercel

The frontend is deployed on Vercel pointing at the `web/` directory.

| Setting | Value |
|---|---|
| Root Directory | `web` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Required environment variable, scoped per Vercel environment:

| Variable | Environment | Value |
|---|---|---|
| `VITE_API_URL` | Preview | `bolao-api-dev` URL on Render |
| `VITE_API_URL` | Production | `bolao-api` URL on Render |

`VITE_API_URL` must **not** be set for "All Environments" — that is what would make PR
previews talk to the production API. Verify the scoping with:

```bash
vercel env ls
```

Builds fail fast when `VITE_API_URL` is missing, so a misconfigured environment surfaces
as a failed deploy instead of a bundle that silently requests `/api` on the Vercel domain.

---

## Features

- **Admin**: register users, add matches, set the closing date, fill in results, track payments (R$ 70 total)
- **Players**: fill in predictions until the closing date
- **Standings**: based on the criteria defined in `SCORING.md`
- **Partial rounds**: filter by round to view cumulative standings
