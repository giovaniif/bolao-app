# Decision records

One file per decision, numbered in order. A record does not change after it is accepted. A new decision that replaces it says "Supersedes ADR n", and the old one gets "Superseded by ADR m". Write new records in the [writing style](../style.md).

| ADR | Decision |
|---|---|
| [0001](0001-go-api-and-react-pwa.md) | Go API and React PWA |
| [0002](0002-layering.md) | Handler, service, repository layering |
| [0003](0003-multi-tenancy-by-bolao.md) | Multi-tenancy by bolão |
| [0004](0004-startup-migrations.md) | Idempotent migrations on startup |
| [0005](0005-hosting.md) | Render, Vercel and Supabase on free plans |
| [0006](0006-web-push-via-pg-cron.md) | Web Push reminders driven by pg_cron |
| [0007](0007-scoped-agents-md.md) | Scoped AGENTS.md files |
| [0008](0008-linear-and-graphite.md) | Linear issues and Graphite stacks |
| [0009](0009-no-comments.md) | No comments |
| [0010](0010-test-first.md) | Test first, enforced by CI |
| [0011](0011-mutation-testing.md) | Mutation testing on the service rules |
| [0012](0012-github-issues-and-gh-stack.md) | GitHub Issues and gh stack (supersedes 0008) |
| [0013](0013-ui-screenshots-on-prs.md) | Playwright screenshots on every UI PR |
| [0014](0014-bolao-as-a-group.md) | A bolão is a group with roles per bolão (supersedes 0003) |
| [0015](0015-matches-from-football-data.md) | Matches come from football-data.org |
| [0016](0016-thesportsdb-as-backup-feed.md) | TheSportsDB is the backup feed for results |
| [0017](0017-nightly-prod-snapshot-into-dev.md) | A nightly prod snapshot, scrubbed, replaces the dev database |
| [0018](0018-api-on-cloud-run.md) | The API moves from Render to Cloud Run (proposed) |
