# ADR 0009: No comments

Status: accepted, 2026-10-13. Adapted from agent-workspace ADR 0044. Replaces the earlier rule "comments only when they earn their place".

## Decision

- The repo has no comments: not in Go (tests included), TS/TSX/JS, CSS, SQL, YAML, shell or Dockerfiles.
- Only tool directives stay, because tools read them: `//go:`, a bare `//nolint:<linters>`, generated-code headers, `/// <reference ...>`, `// eslint-disable-next-line <rule>`, `// eslint-disable-line`, shebangs, `# shellcheck`, `# yaml-language-server:` and Dockerfile `# syntax=`.
- `tools/lint-comments` enforces this in CI (`repo-ci.yml`).
- What a comment used to carry goes elsewhere:
  - A hidden constraint or quirk goes into a test named after it, which fails if the workaround goes, and into the commit message that adds the workaround.
  - Usage and design notes go in the scoped `AGENTS.md`, an ADR, `SCORING.md` or `docs/development.md`.
  - Open work goes in a GitHub issue.
- The files that had comments on adoption sat in an allowlist. BOL-34 emptied it and removed it on 2026-10-13.

## Why

- "Comments only when they earn their place" needs a judgement in each review. Agents wrote comments that restated the code, and review did not catch all of them.
- A total ban is simple to state, simple to lint and leaves nothing to argue about.

## Consequences

- Exported Go identifiers get no doc comments. Names carry the meaning. Nothing here is a published library.
- A quirk with no test that pins it can be "simplified" away. Write the test.
