# ADR 0007: Scoped AGENTS.md files

Status: accepted, 2026-10-13. Adapted from agent-workspace ADR 0041.

## Decision

- The root `AGENTS.md` keeps only repo-wide guidance: the project, commands, rules, workflow and an index. It stays under 150 lines.
- `api/AGENTS.md` and `web/AGENTS.md` hold the guidance for their layer. `ARCHITECTURE.md` holds the stack, the domain and the data flow.
- Each `AGENTS.md` has a `CLAUDE.md` symlink beside it. Codex reads `AGENTS.md`, and Claude Code reads `CLAUDE.md`.
- `tools/lint-agents` in CI fails on a long root, a missing symlink or a broken relative link.

## Why

- Every session loaded five `.claude/*.md` files, most about a layer it did not touch.
- A limit and a check keep the root from growing back.
