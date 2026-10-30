# ADR 0005: Render, Vercel and Supabase on free plans

Status: accepted, 2026-07-23. The API host is superseded by [ADR 0018](0018-api-on-cloud-run.md) once `API_HOST` is `cloudrun`.

## Decision

- The API runs on Render (Docker, free plan), the web on Vercel, the database on Supabase.
- Two environments: dev deploys on each merge to `main`, prod deploys on a `v*` tag (`.github/workflows/deploy.yml`).

## Why

- The pool has a few dozen players. Free plans cover the load.

## Consequences

- Render's free plan sleeps after 15 minutes without traffic. The first request after that takes up to a minute.
- Supabase pauses a free project after a week without activity. A paused project must be restored from its dashboard.
- Nothing in the API can rely on an in-process timer (ADR 0006).
