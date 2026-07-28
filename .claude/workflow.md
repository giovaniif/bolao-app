# Workflow — Linear and Graphite

**Rule: no work without a Linear issue, and related changes ship as a Graphite stack.**

## Linear

Workspace `giovaniif`, team **Bolão**, issue prefix **`BOL-`**.
Statuses: `Backlog → Todo → In Progress → In Review → Done` (plus `Canceled`, `Duplicate`).

### The loop

1. **Find or create the issue before writing code.** If the user asks for something that
   has no issue, create one first — title, a short spec of the expected behaviour, and the
   acceptance criteria. A fix discovered mid-task gets its own issue, not a silent extra
   commit on the current branch.
2. **Every issue carries an estimate.** No exceptions — an unestimated issue is not ready
   to be worked, and creating one without an estimate is an incomplete issue. See below.
3. **Move it to In Progress** when you start.
4. **Use the branch name Linear generates** (`gitBranchName` on the issue, e.g.
   `riccog25/bol-6-nav-unificar-galera-parciais-na-tela-rodada`). That is what auto-links
   the branch, PR, and issue. Where a shorter name is preferred, keep the `bol-<n>` segment
   so the link still resolves.
5. **Reference the issue in the PR description** (`BOL-6`) so Linear tracks the PR and
   moves the issue to In Review.
6. **Done** follows the merge, not the push.

Issue descriptions are written in Portuguese — they are product docs, and that is fine.
The branch name, commits, and code are English (see `.claude/code-style.md`).

### Estimates

**Every issue has an estimate before it is worked on.** An issue without one is not ready:
it has not been thought through far enough to know whether it is a stack or a single PR.

The team uses Linear's Fibonacci scale. Calibrated for this codebase:

| Points | Shape of the work |
|---|---|
| 1 | One layer, no new tests beyond a case or two. Copy change, constant, config |
| 2 | One layer end to end with its tests. A new endpoint on existing repositories, one component |
| 3 | One vertical slice: service + handler + tests, or hook + page + tests. Typically one PR |
| 5 | Backend and frontend both. **Ships as a Graphite stack**, not one branch |
| 8 | Touches the data model or scoring rules, or spans three or more layers. Split it if you can |

Rules of thumb:

- **5 or more means split.** Break it into issues that are each 3 or less, in the stack
  order from "How to slice a stack" below. The parent stays as the tracking issue.
- Estimate the whole cost including tests, lint, and PR review — not just the typing.
- If an issue turns out to be twice its estimate mid-flight, that is a signal to split the
  remainder into a new issue, not to silently keep going.
- Re-estimating is fine and expected. Leaving it blank is not.

When creating issues in bulk, set the estimate at creation time. Going back to fill in
estimates later means the backlog was unplannable in the meantime.

### Splitting issues

One issue = one reviewable unit of behaviour. If a task naturally has a backend half and a
frontend half — as `BOL` work usually does — make them two issues. That is what lets the
work ship as a stack, and it is the pattern the repo already follows: `#1` "introduce
boloes as a first-class tenancy root (backend)" then `#2` "add bolões UI (frontend)".

## Graphite — stacked PRs

The repo is Graphite-initialized (`gt` v1.8+). **When several changes belong to the same
context, stack them.** One giant PR that touches migrations, repositories, handlers, and UI
is not reviewable; four stacked PRs of one layer each are.

### Standard flow

```bash
gt sync                       # pull main, restack, clean up merged branches
gt create -m "feat: add bolao participants table"   # branch + commit in one step
# ... next change, on top of the previous one ...
gt create -m "feat: expose participants via the API"
gt submit --stack             # open/update the whole stack as linked PRs
```

Iterating after review:

```bash
gt modify                     # amend the current branch's commit
gt modify --commit -m "..."   # or add a follow-up commit
gt restack                    # propagate the change up the stack
gt submit --stack             # push the updated stack
```

Useful: `gt log` to see the stack, `gt up` / `gt down` to move between branches,
`gt track` to bring an existing branch under Graphite.

### How to slice a stack

Bottom to top, each PR independently reviewable and each one green on its own:

1. Migration + models
2. Repository
3. Service (business rules + their tests)
4. Handler + routes
5. Web API module + hook
6. Web components/pages

Not every change needs six PRs — but when a change spans backend and frontend, the seam
between them is always a stack boundary.

### Rules for the stack

- Never rebase or force-push a stacked branch by hand; `gt restack` exists for that and
  hand-rebasing desynchronizes the children.
- Each PR in the stack carries its own tests. A stack whose tests all sit in the top PR
  defeats the point.
- Merge bottom-up, with `gt sync` after each merge.
- If a branch stops being related to the stack, take it out — stacks are for one context.

## Commits and PRs

Conventional commits, in English, imperative mood:

```
feat: count missing predictions as 0×0 once the market closes
fix: serve index.html for unknown paths so SPA deep links survive reload
chore: allow Tailscale MagicDNS hostnames in vite dev server
ci: add GitHub Actions for tests/build
```

Prefixes in use: `feat`, `fix`, `chore`, `ci`, `docs`, `refactor`, `test`.

Subject lines say **why** where it's not obvious — `fix: default to the latest round on
Palpites and Parciais` is better than `fix: round bug`. PRs squash-merge into `main` with
the PR number appended (`(#14)`), so the commit subject is what survives in history. Make
it count.

PR description covers: the Linear issue, what changed, how it was verified. Never open a
PR from a branch whose checklist in `.claude/linting.md` has not passed.

## What ships where

- **Merge to `main`** → auto-deploys to **dev/staging** (Render `bolao-api-dev` + Vercel
  dev alias, Supabase dev DB).
- **Tag `v*`** → deploys to **production**.

So `main` is a live environment. Do not merge a stack halfway and leave the API expecting
a UI that has not shipped — order the merges so each state of `main` is coherent.
