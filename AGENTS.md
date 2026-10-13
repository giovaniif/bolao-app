# Bolão Brasileirão

A prediction pool for the Brazilian football championship. Players predict the scores of each round, and the app scores the predictions and keeps the standings. A Go API (`api/`) and a React PWA (`web/`) share one PostgreSQL database.

- How to run it locally and deploy it: [README.md](README.md)
- The stack, the domain and the data flow: [ARCHITECTURE.md](ARCHITECTURE.md)
- The scoring rules (the specification): [SCORING.md](SCORING.md)
- Decisions: [docs/adr/](docs/adr/README.md)
- Terms and writing style: [docs/style.md](docs/style.md)
- Work items: [GitHub issues](https://github.com/giovaniif/bolao-app/issues), each with an `estimate: N` label

## Scoped guidance

Claude Code and Codex load an `AGENTS.md` from each directory they work in. Here, `CLAUDE.md` is a symlink to it. Guidance for one area lives next to the code it covers:

| Directory | Covers |
|---|---|
| [api/](api/AGENTS.md) | layering, multi-tenancy, migrations, Go conventions, backend tests and lint |
| [web/](web/AGENTS.md) | feature folders, the data path, TS/React conventions, PWA and push, frontend tests and lint |
| [tools/](tools/AGENTS.md) | the repo lint tools (`lint-agents`, `lint-comments`) |

**Where guidance goes.** Put area-specific guidance in the `AGENTS.md` of the directory where most edits for it start, not here. Give a new scoped `AGENTS.md` a `CLAUDE.md` symlink beside it (`ln -s AGENTS.md CLAUDE.md`) and a row in the table above. Keep this file under 150 lines. `lint-agents` checks the line count, the symlinks and every relative link. See [ADR 0007](docs/adr/0007-scoped-agents-md.md).

## Writing docs

Write prose docs, ADRs, issues and PR descriptions in the Simplified Technical English of [docs/style.md](docs/style.md). Use its glossary terms. When you edit prose, do not change code, commands, paths or identifiers.

## Commands

```bash
cd api && gofmt -l . && go vet ./... && golangci-lint run ./... && go test ./... -short
cd web && npm run lint && npm run test:coverage && npm run build
cd tools && go test ./... && go run ./lint-agents .. && go run ./lint-comments ..
tools/mutate                      # mutation testing on api/internal/service; needs gremlins
```

- `gofmt -l .` must print nothing. Its exit code is 0 even when it lists files.
- `npm run build` runs `tsc -b`, so type errors fail it. Run the build, not only the lint.
- Report what ran. If a command fails, show the output. Do not report success on unverified work.

## Rules

1. **Tests always, and first** ([ADR 0010](docs/adr/0010-test-first.md)). Every change in behavior adds or updates tests. Coverage never goes down in the package or file you touch. If you cannot test something, say so in the PR and explain why.
   - Write the failing test, see it fail, then write the code. Commit the test before the code that makes it pass.
   - CI's `tdd` job (`tools/tdd-check`) fails a PR when a non-merge commit changes tests and production code together. `refactor:` commits and Markdown are exempt.
   - It also runs the PR's new and changed tests on the base branch. They must fail there. A test-only PR titled `test:` is exempt.
   - Check a branch before you push: `tools/tdd-check origin/main HEAD` on a clean tree.
2. **English everywhere** ([ADR 0012](docs/adr/0012-github-issues-and-gh-stack.md)). Identifiers, comments, test names, commits, branches, docs, issues, PR titles and PR descriptions are English. Portuguese is only for product copy that users read:
   - UI strings in `web/`
   - API error messages (the web shows `data.error` as is)
   - route paths and query-param values (`/palpites`, `?rodada=7`), because people share the links
3. **`bolão` is the one domain word kept in Portuguese** in identifiers (`bolao`, `Bolao`, `boloes`), because the DB schema and the API contract use it. Use English for all other terms: `round`, `match`, `prediction`, `partial`, `classification`, `participant`. Old names such as `PartiaisPage` and `parciais/` are legacy. Rename them only when you refactor that area.
4. **No comments, anywhere** ([ADR 0009](docs/adr/0009-no-comments.md)). This covers Go (tests too), TS/TSX, CSS, SQL, YAML, shell and Dockerfiles. Names and tests explain the code.
   - Put a constraint or quirk that the code cannot show into a test named after it, and into the commit message of the workaround.
   - Put usage and design notes in the scoped `AGENTS.md`, an ADR or the README. Put open work in a GitHub issue.
   - Only tool directives stay: `//go:`, a bare `//nolint:<linters>`, generated-code headers, `/// <reference ...>`, `// eslint-disable-next-line <rule>`, shebangs, `# yaml-language-server:` and Dockerfile `# syntax=`.
   - `tools/lint-comments` fails CI on all other comments.
5. **Lint clean.** Zero errors and zero warnings in both projects. Do not silence a rule. A single-line disable names the rule, and the commit message gives the reason.
6. **Scoring changes touch three files together:** `api/internal/service/scoring.go`, its tests and `SCORING.md`, in the same PR. If code and doc disagree, that is a bug.

## Workflow

### Issues

See [ADR 0012](docs/adr/0012-github-issues-and-gh-stack.md).

1. Find or create the GitHub issue before you write code (`gh issue list`, `gh issue create`). A fix found mid-task gets its own issue.
2. Give every issue an `estimate: N` label before work starts (Fibonacci):

   | Points | Shape of the work |
   |---|---|
   | 1 | One layer, a case or two of tests. Copy, a constant, config |
   | 2 | One layer end to end with its tests. A new endpoint, one component |
   | 3 | One vertical slice: service + handler + tests, or hook + page + tests |
   | 5 | Backend and frontend. Ships as a stack |
   | 8 | Data model, scoring rules, or three or more layers. Split it |

   5 or more means split into issues of 3 or less. The parent stays as the tracking issue and lists the parts as a task list. If an issue grows to twice its estimate, split the rest into a new issue.
3. Assign yourself when you start (`gh issue edit <n> --add-assignee @me`). Name the branch `<n>-<short-slug>`.
4. Put `Closes #<n>` in the PR description. The merge closes the issue. Do not close it by hand before the merge.

### Stacks

Related changes ship as a stack of small PRs, bottom to top, each green on its own:

1. Migration and models
2. Repository
3. Service (rules and their tests)
4. Handler and routes
5. Web API module and hook
6. Web components and pages

```bash
gh stack init <n>-<slug>             # start a stack on main
gh stack add <n>-<slug>              # add a branch on top
gh stack rebase                      # restack after a change lower down
gh stack submit --auto --open        # push and open or update every PR
gh stack sync                        # fetch, rebase on main, push, drop merged branches
gh stack merge <top-pr> --squash     # merge the stack up to that PR, after approval
```

- Do not rebase or force-push a stacked branch by hand. Use `gh stack rebase` and `gh stack push`.
- After `--auto`, set each PR's title and description with `gh pr edit` or the REST API.
- Each PR carries its own tests. The seam between backend and frontend is always a stack boundary.

### Commits and PRs

- Conventional commits, imperative mood: `feat`, `fix`, `chore`, `ci`, `docs`, `refactor`, `test`. Say *why* when it is not obvious.
- PRs squash-merge, so the PR title is the line that stays in `main`. Make it specific.
- The PR description gives `Closes #<n>`, what changed and how you verified it.
- Do not open a PR until the commands above pass.
- CodeRabbit reviews each PR with the rules in `.coderabbit.yaml`. Fix or answer each finding before you merge.

### Deploys

- A merge to `main` deploys **dev**: Render `bolao-app-dev`, the Vercel dev alias and the Supabase dev project.
- A `v*` tag deploys **production** ([ADR 0005](docs/adr/0005-hosting.md)). Release with `gh release create v<version> --target main --generate-notes`.
- `main` is a live environment. Order merges so that each state of `main` works: do not leave the API waiting for a UI that is not merged.
