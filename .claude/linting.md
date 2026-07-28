# Linting and formatting

**Rule: both `web/` and `api/` must lint clean before a PR goes up.** Zero errors, zero
warnings. A warning you intend to ignore is a warning that will be ignored forever.

## Web

```bash
cd web
npm run lint          # eslint .
npm run build         # tsc -b && vite build — type errors are lint errors too
```

Config: `web/eslint.config.js` (flat config), composed of:

- `@eslint/js` recommended
- `typescript-eslint` recommended
- `eslint-plugin-react-hooks` — rules-of-hooks and exhaustive-deps
- `eslint-plugin-react-refresh` (Vite fast-refresh safety)

Working with it:

- `react-hooks/exhaustive-deps` is a real bug detector. Fix the dependency array or
  restructure — do not silence it.
- No blanket `/* eslint-disable */` at the top of a file. A single-line disable needs a
  comment naming the reason, and that is one of the few comments worth writing.
- `tsc -b` runs in `npm run build`, so type errors fail CI even though ESLint passes. Run
  the build, not just the lint, before pushing.

## API

```bash
cd api
gofmt -l .            # must print NOTHING; any listed file is unformatted
go vet ./...          # must exit clean
go build ./...
golangci-lint run ./... # must print "0 issues"
```

`gofmt -l .` printing a filename is a failure even though its exit code is 0 — check the
output, not just the status. To fix: `gofmt -w .`.

`go vet` is what CI runs (`.github/workflows/backend-ci.yml`, Test job). Both are currently
clean; keep them that way.

The API is configured for `golangci-lint` v2 via `api/.golangci.yml`, targeting Go 1.23.
It enables `errcheck`, `staticcheck`, `ineffassign`, `unused`, and `govet` — catching
unused code, shadowed errors, and unchecked returns that `gofmt` and `go vet` alone miss.
Run it with `cd api && golangci-lint run ./...`; a clean run prints `0 issues.`.

> Gap to close: `golangci-lint` is not yet wired into CI (see the CI table below), so a
> green PR is not proof it passed — run it locally before pushing until that's tracked
> and closed.

## CI

Lint and tests are enforced per area, and each workflow only triggers on paths in that area:

| Workflow | Jobs |
|---|---|
| `.github/workflows/backend-ci.yml` | `build` (`go build ./...`), `test` (`go vet ./...` + `go test ./... -short`) |
| `.github/workflows/frontend-ci.yml` | `build` (`npm run build`), `test` (`npm test`) |

Note what CI does **not** run today: `gofmt -l`, `npm run lint`, and any coverage check.
Run them locally — a green PR is not proof they passed. Wiring them into CI is a tracked
task; until then, this document is the enforcement.

## Pre-PR checklist

```bash
cd api && gofmt -l . && go vet ./... && go test ./... -short && go build ./...
cd web && npm run lint && npm test && npm run build
```
