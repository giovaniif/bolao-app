# tools

Repo tooling, as its own Go module (`github.com/bolao-app/tools`). The repo-wide rules are in the [root AGENTS.md](../AGENTS.md). CI runs these in `.github/workflows/repo-ci.yml`.

```bash
go test ./...
go run ./lint-agents ..
```

- **`lint-agents [root]`**: fails when one of these conditions is true:
  - The root `AGENTS.md` is longer than 150 lines (`-max n`).
  - A scoped `AGENTS.md` has no `CLAUDE.md` symlink to it beside it.
  - A relative link in an `AGENTS.md` or `ARCHITECTURE.md` does not resolve.

  It skips `testdata/`, `.claude/`, `.git/`, `node_modules/`, `vendor/`, `bin/`, `dist/` and `coverage/`. Its fixtures are directory trees under its `testdata/`.
