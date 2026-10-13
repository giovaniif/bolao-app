# ADR 0013: Playwright screenshots on every UI PR

Status: accepted, 2026-10-13.

## Decision

- `web/e2e/` holds Playwright specs that open each main screen of the built app with a mocked API, at phone size (390×844), on a fixed clock. Each spec fails on a browser error, on an API call with no mock, or when the screen does not show its expected text. It then saves a screenshot.
- CI's `UI screenshots` job runs the specs on each PR that changes `web/`. `tools/pr-screenshots` puts the images on the `pr-screenshots` branch and keeps one comment on the PR with all of them.
- An agent that changes UI runs the same specs before it pushes, looks at each screenshot of a screen it changed, and fixes what is wrong. A new screen or a new state gets a new entry in `web/e2e/screens.spec.ts`.
- Screenshots are evidence for review, not a pixel diff. A changed screenshot does not fail CI.

## Why

- Unit tests under jsdom do not render CSS or layout. A broken layout, a missing safe-area pad or an empty page passes them.
- A reviewer on a phone can check the UI in the PR without a local build.
- Pixel diffs fail on font and anti-aliasing changes between machines. The text, error and mock checks catch real breaks without that noise.

## Notes

- The images live on the `pr-screenshots` branch, not in `main`. The repo is public, so `raw.githubusercontent.com` links render in the comment. Delete the branch to prune it; the next run recreates it.
- PRs from forks get the screenshots as a run artifact only, because their token cannot push.
