# ADR 0004: Idempotent migrations on startup

Status: accepted, 2026-01-31.

## Decision

- `runMigrations` in `cmd/server/main.go` applies a hardcoded list of `.sql` files on every start.
- Each migration is idempotent: `IF NOT EXISTS` and guarded `DO $$` blocks.
- Only `001_init.sql` stops the start on failure. The others log and continue.
- A migration that ran anywhere does not change. A fix is a new migration.

## Why

- The API deploys as one container on Render with no release step. The start is the only hook.

## Consequences

- A non-idempotent migration fails quietly in production. Test a new migration twice against a real database.
