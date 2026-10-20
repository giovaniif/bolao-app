# ADR 0003: Multi-tenancy by bolão

Status: superseded by [ADR 0014](0014-bolao-as-a-group.md). Accepted 2026-07-23.

## Decision

- A bolão is one season. Every domain row has a `bolao_id`.
- Exactly one bolão is active (`idx_boloes_one_active`). Writes go only to it. A finished bolão is read-only.
- Handlers resolve the bolão with `resolveBolaoID`: `?bolao_id=` if present, else the active one.

## Why

- Players keep the history of past seasons (the Hall of Champions) in the same database.
- One helper for the fallback keeps every endpoint consistent.

## Consequences

- A query without a `bolao_id` filter leaks another season's data. Review treats it as a bug.
