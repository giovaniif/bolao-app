# ADR 0002: Handler, service, repository layering

Status: accepted, 2026-01-31.

## Decision

- `handler → service → repository`. The arrows point one way only.
- Handlers parse, validate, authorize and respond. They never write SQL.
- Services hold the business rules. They never import `gin` or touch `*pgxpool.Pool`.
- Repositories map rows to `models`. They hold no business rules.
- All wiring is in `cmd/server/main.go`, by constructor parameters. There is no DI container and no global state.

## Why

- Rules in pure service functions are cheap to table-test. `internal/service` is where the tests matter most.
- Constructor wiring keeps handlers constructible in tests with fakes.
