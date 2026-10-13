# ADR 0012: GitHub Issues and gh stack

Status: accepted, 2026-10-13. Supersedes [ADR 0008](0008-linear-and-graphite.md).

## Decision

- No work starts without a GitHub issue in this repo. Every issue has an `estimate: N` label (Fibonacci: 1, 2, 3, 5, 8). An estimate of 5 or more splits into issues of 3 or less.
- Related changes ship as a stack of small PRs, one layer each, made with the `gh stack` extension (`github/gh-stack`). A stack merges with `gh stack merge`, which merges all its PRs to `main` in one operation.
- PRs squash-merge. The PR title is the line that stays in `main`. The PR description says `Closes #N`, so the merge closes the issue.
- Issues, PRs, commits and docs are English. Product copy stays Portuguese.

## Why

- The code, the PRs, the issues and the stacks are in one tool. An agent needs only `gh` to do the full workflow.
- Linear and Graphite added two accounts and two sync points. Neither gave a function that GitHub does not give now.
- A PR of one layer is reviewable. A PR that spans migrations, handlers and UI is not.
- `main` deploys dev on each merge, so each merged state must work.

## Migration

- The open Linear issues BOL-17, BOL-20, BOL-21, BOL-22 and BOL-23 moved to GitHub issues #43 to #47. Each one names its Linear key.
- Old commits and PRs keep their `BOL-` keys. Do not rewrite them.
