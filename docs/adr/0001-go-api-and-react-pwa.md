# ADR 0001: Go API and React PWA

Status: accepted, 2026-01-31.

## Decision

- The API is Go with Gin and pgx/v5 on PostgreSQL, in `api/`.
- The web is React with TypeScript, Vite, TanStack Query and Tailwind, in `web/`. It is a PWA (ADR 0006).
- The API and the web are two projects in one repo. They share only the JSON contract.

## Why

- Go gives one small binary and a fast start on the free Render plan.
- pgx with raw SQL keeps the queries visible. The data model is small and stable.
- A PWA reaches iPhone and Android players without app store accounts.
