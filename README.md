# Bolão Brasileirão

Prediction pool management app for the Brazilian football championship.

## Stack

- **Frontend**: React + TypeScript + Tailwind + Vite
- **Backend**: Go + Gin + PostgreSQL
- **Infra**: Docker Compose (dev), Render (API), Vercel (frontend), Supabase (database), GitHub Actions (CI/CD)

---

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

---

## Full Docker Compose (optional)

To run everything via Docker (no hot reload):

```bash
docker compose up --build
# Frontend: http://localhost:5175 | API: http://localhost:3335
```

---

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

---

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

## First access

1. Create the first admin user via SQL (default initial password: `123`):

```sql
INSERT INTO users (id, username, display_name, is_admin, amount_paid, password_hash, must_change_password)
VALUES (
  gen_random_uuid(),
  'admin',
  'Administrator',
  true,
  0,
  '$2a$10$uTr26SWYWuGs.D/j0JJtf.ClwuNgzbE38JRdB76Xoyk41JKdNKkv2',
  true
);
```

2. Access the app and log in with username `admin` and password `123`.

3. On first login, you'll be required to change the password.

4. As admin, register the other users (all start with password `123`) and add the round matches.

## Features

- **Admin**: register users, add matches, set the closing date, fill in results, track payments (R$ 70 total)
- **Players**: fill in predictions until the closing date
- **Standings**: based on the criteria defined in `criterios.md`
- **Partial rounds**: filter by round to view cumulative standings

## Predictions seed

To import predictions from a file (e.g. for the first round):

```bash
make seed-palpites
# or: cd api && go run ./cmd/seed-palpites ../palpites.md
```

The `palpites.md` file must have:
1. Match order (Home x Away)
2. For each user: name (username) followed by scores in the same order

Example:
```
Match order:
Vitória x Remo
Atlético-MG x Palmeiras
...

user1
1x2
0x1
...
```

## Tests

```bash
# Backend
cd api && go test ./...

# Frontend
cd web && npm run test
```
