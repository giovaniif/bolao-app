---
name: babysit-prs
description: Keep this repo's open PRs mergeable. Fix failed CI, answer or fix review comments, rebase stacks that conflict, check the UI screenshots, and report what is left. Use when asked to babysit, watch, shepherd or keep PRs green, or with /loop (for example "/loop 10m /babysit-prs"). Takes optional PR numbers; with none, it covers every open PR by the current user.
---

# Babysit PRs

One pass over the open PRs. Each pass does what it can, pushes, and reports. With `/loop`, the next pass picks up the CI runs that the last push started.

Follow the repo rules in `AGENTS.md` for every fix: test first, no comments, lint clean, English.

## Rules

- **Never merge.** Merging needs the user's approval for that stack. When a stack is ready, say so in the report and give the command: `gh stack merge <top-pr> --squash`.
- **Never force-push by hand.** Use `gh stack rebase`, then `gh stack push`. For a PR that is not in a stack, `git push --force-with-lease` is fine.
- **Never weaken a check** to make it pass: no skipped tests, lowered thresholds, rule disables or filtered errors. If the check is wrong, say so in the report and stop on that PR.
- **Do not change scope.** Fix what CI or a reviewer asked for. Put a new idea in a GitHub issue.
- Before a pass changes a branch, the worktree must be clean. If it is not, report that and stop.

## One pass

### 1. List the PRs

```bash
gh pr list --author @me --state open --json number,title,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,reviewDecision
```

Use the PR numbers that you were given, if any. Work bottom-up in each stack (`gh stack view`), because a fix low in a stack changes the PRs above it.

### 2. CI

```bash
gh pr checks <n>
gh run view <run-id> --log-failed
```

- **Pending:** leave it for the next pass.
- **Failed:** read the log, reproduce it locally with the command in `AGENTS.md`, fix it, run the full command set again, commit and push.
- **Flaky** (it passes locally and the log shows a timeout or a network error): rerun it once with `gh run rerun <run-id> --failed`. If it fails a second time, treat it as a real failure.
- **`Test first`:** split the commit. The test goes in its own commit before the code. A test that passes on base does not cover new behavior: fix the test, or move it to a `test:` PR.

### 3. Review comments

```bash
gh api repos/{owner}/{repo}/pulls/<n>/comments --paginate
gh api repos/{owner}/{repo}/pulls/<n>/reviews --paginate
gh api repos/{owner}/{repo}/issues/<n>/comments --paginate
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved comments(first:20){nodes{author{login} body path line}}}}}}}' -F o=<owner> -F r=<repo> -F n=<n>
```

Read every review thread that is not resolved.

- **Correct finding:** fix it, push, then reply on the thread with the commit SHA and resolve it (`resolveReviewThread` mutation).
- **Wrong finding:** reply with the reason, in one or two sentences, and leave it open for the reviewer.
- **A person asks a question or makes a design decision:** do not decide for them. Put it in the report.

### 4. Conflicts and stacks

When `mergeable` is `CONFLICTING` or a PR is behind its base:

```bash
gh stack checkout <n>
gh stack sync
```

If `gh stack sync` stops on a conflict, run `gh stack rebase`, resolve each file, run `gh stack rebase --continue`, run the tests, and then run `gh stack push`. When a resolution is not clear, abort with `gh stack rebase --abort` and report it.

### 5. UI screenshots

For a PR that changes `web/`, find the comment that starts with `<!-- ui-screenshots -->`. Open the images of the screens that the PR changes, and check layout, text and overflow. If a screen is wrong, fix it as in the UI check in `web/AGENTS.md`. If the comment is missing and the `UI screenshots` job passed, run `tools/pr-screenshots <n>` after `npm run e2e` in `web`.

### 6. Report

End each pass with one short table and nothing else:

| PR | CI | Reviews | State | Needs you |
|---|---|---|---|---|

- **State:** `ready to merge`, `waiting on CI`, `fixed: <what>` or `blocked: <why>`.
- **Needs you:** the decisions and approvals that only the user can give, for example "approve the merge of the stack up to #41".

When every PR in a stack is green, has no open threads and is mergeable, say that it is ready and give the `gh stack merge` command. With `/loop`, stop the loop once every PR is either ready or blocked on the user.
