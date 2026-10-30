# ADR 0018: The API moves from Render to Google Cloud Run

Status: proposed, 2026-10-29. Supersedes the Render part of [ADR 0005](0005-hosting.md).

## Decision

- Both APIs, `bolao-api` (prod) and `bolao-api-dev`, run on Cloud Run with the same `api/Dockerfile`, request-based billing and `min-instances=0`.
- `deploy.yml` builds from source with `google-github-actions/deploy-cloudrun`. Dev deploys on `main`, prod only on a `v*` tag, as before.
- GitHub signs in to Google Cloud with Workload Identity Federation. No service-account key is stored.
- The runtime env vars (`DATABASE_URL`, `JWT_SECRET`, `VAPID_*`, `CRON_SECRET`, ...) are set once on each service by the owner. A deploy only changes the image and `RENDER_GIT_COMMIT`.
- The repo variable `API_HOST` chooses the host during the move: `render` (default), `both` or `cloudrun`.
- After a dev DB sync, the workflow updates an env var on `bolao-api-dev` whenever `GCP_PROJECT_ID` is set, whatever `API_HOST` says. The new revision starts and runs the migrations ([ADR 0004](0004-startup-migrations.md)).

## Why

- Render's free plan gives about 750 instance hours a month per workspace. `pg_cron` calls both APIs every minute ([ADR 0006](0006-web-push-via-pg-cron.md)), so both stay awake about 1,490 hours.
- Cloud Run bills only while a request runs. Its free tier is 2 million requests, 180,000 vCPU-seconds and 360,000 GiB-seconds a month per billing account. Two ticks a minute are about 86,400 requests a month.

## Consequences

- A Cloud Run project needs a billing account, even on the free tier. Set a budget alert.
- The first request after idle starts a container. Migrations run at each start, so a cold start is slower than a warm one.
- Installed TestFlight builds call `onrender.com` URLs that are compiled in. Render stays up as a fallback until no installed build uses it.
- Free data transfer is 1 GB a month from North America, so the services run in `us-central1` unless `GCP_REGION` says otherwise.
