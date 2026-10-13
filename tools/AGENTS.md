# tools

Repo tooling, as its own Go module (`github.com/bolao-app/tools`). The repo-wide rules are in the [root AGENTS.md](../AGENTS.md). CI runs these in `.github/workflows/repo-ci.yml`.

```bash
go test ./...
go run ./lint-agents ..
go run ./lint-comments -allow lint-comments/allowlist.txt ..
```

- **`lint-agents [root]`**: fails when one of these conditions is true:
  - The root `AGENTS.md` is longer than 150 lines (`-max n`).
  - A scoped `AGENTS.md` has no `CLAUDE.md` symlink to it beside it.
  - A relative link in an `AGENTS.md` or `ARCHITECTURE.md` does not resolve.

  It skips `testdata/`, `.claude/`, `.git/`, `node_modules/`, `vendor/`, `bin/`, `dist/` and `coverage/`. Its fixtures are directory trees under its `testdata/`.
- **`lint-comments [-allow file] [root...]`**: fails on any comment in these files ([ADR 0009](../docs/adr/0009-no-comments.md)):
  - Go (with `go/ast`), shell (`.sh` or a shell shebang), Makefiles, YAML, SQL and Dockerfiles.
  - TypeScript and JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` and others), and CSS.

  Only tool directives pass: `//go:`, a bare `//nolint:<linters>`, generated-code headers, `/// <reference ...>`, `// eslint-disable-next-line <rule>`, `// eslint-disable-line`, shebangs, `# shellcheck`, `# yaml-language-server:` and Dockerfile `# syntax=`. It walks `.github/` but no other dot dir. It skips `vendor/`, `node_modules/`, `bin/`, `dist/`, `coverage/` and Go files under `testdata/`. Its fixtures are in its `testdata/` as `*.<ext>.txt`.

  `-allow` names a file of paths, relative to each root, to skip. `lint-comments/allowlist.txt` holds the files that had comments when the rule started. Do not add to it. Remove a file from it when you clean it.
