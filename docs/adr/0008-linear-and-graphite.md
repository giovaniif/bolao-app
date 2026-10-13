# ADR 0008: Linear issues and Graphite stacks

Status: superseded by [ADR 0012](0012-github-issues-and-gh-stack.md), 2026-10-13. Accepted 2026-07-28.

## Decision

- No work starts without a Linear issue (team Bolão, `BOL-`). Every issue has a Fibonacci estimate. An estimate of 5 or more splits into issues of 3 or less.
- Related changes ship as a Graphite stack of small PRs, one layer each, merged bottom-up.
- PRs squash-merge. The PR title is the line that stays in `main`.
- Issues, PRs, commits and docs are English. Product copy stays Portuguese.

## Why

- A PR of one layer is reviewable. A PR that spans migrations, handlers and UI is not.
- `main` deploys dev on each merge, so each merged state must work.
