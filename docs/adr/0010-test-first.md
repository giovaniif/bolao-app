# ADR 0010: Test first, enforced by CI

Status: accepted, 2026-10-13. Adapted from agent-workspace ADRs 0033 and 0043.

## Decision

- Write the failing test first, then the code. Commit the test before the code.
- `tools/tdd-check`, in the `tdd` job of `repo-ci.yml`, fails a PR when:
  1. a non-merge commit changes tests and production code together, or
  2. a new or changed test passes on the base branch.
- `refactor:` commits are exempt from rule 1, because renames must change both sides to compile. Markdown is not production code.
- A PR titled `test:` that changes only tests is exempt. Deflakes and test refactors use it.
- Tests in `api/internal/repository` need a database and are not run on base.

## Why

- "Every change ships with tests" did not say when the test is written. A test written after the code often only restates it.
- A test that fails on base proves that it covers the new behavior.

## Consequences

- A feature PR has at least two commits: `test:` then `feat:`. Squash-merge keeps one line in `main`.
- A PR that adds tests for behavior that already exists fails rule 2. Title it `test:` and keep it test-only.
