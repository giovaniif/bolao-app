# tools

Repo tooling, as its own Go module (`github.com/bolao-app/tools`). The repo-wide rules are in the [root AGENTS.md](../AGENTS.md). CI runs these in `.github/workflows/repo-ci.yml`.

```bash
go test ./...
go run ./lint-agents ..
go run ./lint-comments ..
```

- **`lint-agents [root]`**: fails when one of these conditions is true:
  - The root `AGENTS.md` is longer than 150 lines (`-max n`).
  - A scoped `AGENTS.md` has no `CLAUDE.md` symlink to it beside it.
  - A relative link in an `AGENTS.md` or `ARCHITECTURE.md` does not resolve.

  It skips `testdata/`, `.claude/`, `.git/`, `node_modules/`, `vendor/`, `bin/`, `dist/` and `coverage/`. Its fixtures are directory trees under its `testdata/`.
- **`lint-comments [root...]`**: fails on any comment in these files ([ADR 0009](../docs/adr/0009-no-comments.md)):
  - Go (with `go/ast`), shell (`.sh` or a shell shebang), Makefiles, YAML, SQL and Dockerfiles.
  - TypeScript and JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` and others), and CSS.

  Only tool directives pass: `//go:`, a bare `//nolint:<linters>`, generated-code headers, `/// <reference ...>`, `// eslint-disable-next-line <rule>`, `// eslint-disable-line`, shebangs, `# shellcheck`, `# yaml-language-server:` and Dockerfile `# syntax=`. It walks `.github/` but no other dot dir. It skips `vendor/`, `node_modules/`, `bin/`, `dist/`, `coverage/` and Go files under `testdata/`. Its fixtures are in its `testdata/` as `*.<ext>.txt`.
- **`tdd-check <base> <head>`**: the check that CI's `tdd` job runs ([ADR 0010](../docs/adr/0010-test-first.md)). Adapted from agent-workspace.
  - **Commit order.** It fails when a non-merge commit in `base..head` changes tests and production code together. Tests are `*_test.go`, files under a `testdata/` dir, `web/**/*.test.ts(x)` and helpers under `web/src/test/`. A `refactor:` or `refactor(` commit is exempt, and so are Markdown files.
  - **Fail on base.** It checks out the base, puts the PR's added and changed tests on it, and runs them. Go tests run with `go test -short` in the module that owns them (the nearest `go.mod`, so `api/` or `tools/`). Web tests run with `npx vitest run <file>` after `npm ci`. If any passes, the job fails.
  - **Ignored changes.** A Go test change with the same Go tokens (whitespace, comments) does not count. Nor do `fakes_test.go` or `*_fake_test.go` files.
  - **Skipped dirs.** `TDD_SKIP_DIRS` (default `api/internal/repository`) lists dirs whose tests need a database. CI has none, so their tests would skip and look like passes.
  - **`test:` PRs.** A PR titled `test:` whose changed files are all tests is exempt. CI passes the title in `TDD_PR_TITLE`.
  - `TDD_WEB_INSTALL` and `TDD_WEB_TEST` replace the two web commands. Its tests in `tddcheck/` use them to run without Node.
  - It refuses uncommitted changes. On exit, pass or fail, it puts back the branch you started on.
