# AGENTS.md

Instructions for any coding agent working in this repository (Claude Code, Codex, Cursor,
Copilot, …). Claude Code reads `CLAUDE.md`, which points at the same detailed documents
listed below — keep both entry points in sync when the rules change.

## Project

Prediction pool ("bolão") for the Brazilian football championship.

| Area | Stack | Path |
|---|---|---|
| API | Go 1.23, Gin, pgx/v5, PostgreSQL | `api/` |
| Web | React 19, TypeScript, Vite, TanStack Query, Tailwind v4 | `web/` |
| Infra | Docker Compose (dev), Render (API), Vercel (web), Supabase (DB), GitHub Actions | root |

Local setup lives in `README.md`. The scoring rules are specified in `SCORING.md`
(repo root), cited by both the README and `internal/service/scoring.go`. It **is** the
specification: a change to any scoring constant or rule must update `scoring.go`, its
tests, and `SCORING.md` together, in the same PR.

## Non-negotiable rules

1. **Tests always.** Every behavioural change adds or updates tests, and no change may
   lower coverage in the package or module it touches. See `.claude/testing.md`.
2. **Code is English.** Identifiers, comments, commit messages, branch names, test names.
   So is all repository documentation, and everything written *about* the code: Linear
   issue titles and descriptions, PR titles and PR descriptions. Portuguese is reserved
   for user-facing product copy only: UI strings in `web/`, API error messages returned to
   clients, and route or query-param values. See `.claude/code-style.md`.
3. **Comments are the exception, not the habit.** Write one only when the *why* cannot be
   read off the code — a non-obvious invariant, a workaround, a business rule with an
   external source. Never narrate what the next line does. See `.claude/code-style.md`.
4. **Both projects must lint clean.** `npm run lint` in `web/`, `gofmt` + `go vet` in
   `api/`, with zero warnings. See `.claude/linting.md`.
5. **Linear issue first, Graphite stack second.** No work without an issue, and no issue
   without an estimate; related changes ship as a stack of small PRs rather than one large
   branch. An estimate of 5 or more means split it. See `.claude/workflow.md`.

## Reference documents

| Document | Covers |
|---|---|
| `.claude/testing.md` | What to test per layer, coverage policy, table-driven and RTL patterns |
| `.claude/code-style.md` | English-only rule, comment policy, Go and TypeScript conventions |
| `.claude/linting.md` | Lint/format commands, CI expectations, known gaps |
| `.claude/workflow.md` | Linear issue lifecycle, Graphite stacked PRs, commits, deploys |
| `.claude/architecture.md` | Layering in `api/`, feature folders in `web/`, data flow, migrations |

## Verification gate

Nothing is "done" until this passes:

```bash
cd api && gofmt -l . && go vet ./... && go test ./... -short
cd web && npm run lint && npm test && npm run build
```

`gofmt -l .` must print nothing. If a command fails, say so and show the output — do not
report success on unverified work.
