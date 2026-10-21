# ADR 0017: Nightly prod snapshot into dev

Status: accepted, 2026-10-21.

## Decision

- The workflow `.github/workflows/sync-dev-db.yml` copies the prod database into the dev database every day at 06:00 UTC (03:00 BRT). No match is live at that time. You can also start it by hand.
- It runs `tools/sync-dev-db/sync.sh`. The script uses the `postgres:17` client image, which can dump older servers.
- The steps are:
  1. `pg_dump` dumps only schema `public` of prod, without owners and privileges.
  2. In one transaction on dev, `reset.sql` drops every object in schema `public`, the dump loads, and `scrub.sql` runs. A failure leaves dev as it was.
  3. The script calls the Render deploy hook of the dev API. The API start runs all migrations again ([ADR 0004](0004-startup-migrations.md)).
- The scrub removes the data that can reach a real person from dev:
  - It deletes all rows of `push_subscriptions`, `expo_push_tokens`, `password_reset_tokens`, `user_identities` and `user_notification_log`.
  - It sets `users.email` to `NULL` for every user except `giovani`, the owner.
  - It keeps the password hashes, so testers sign in on dev with their prod password.
  - It turns on row level security and revokes the Supabase `anon` and `authenticated` grants again, as migration `017` does.
- The scrub skips a table that prod does not have yet.

## Why

- Dev runs `main`, so its schema is often ahead of prod. Replication (CDC) needs the same schema on both sides. A snapshot takes the prod schema, and the API start then moves dev forward with the idempotent migrations.
- With replication, writes on dev conflict with the stream from prod. A snapshot replaces dev, so tests on dev can write freely during the day.
- Supabase logical replication needs a publication, a subscription and a connection between two projects. That is a large setup cost for a free-plan app. A snapshot needs only two database URLs.
- Without the scrub, dev sends real emails and pushes to players. The same reminders would come from two environments.

## Consequences

- Dev data is at most one day old. Changes made on dev are lost every night.
- A migration must work on the prod schema of the last release, not only on the schema of dev. The test in `tools/syncdevdb` checks this with prod one release behind.
- Sign-in with Apple or Google does not work on dev for a copied user until that user links the account again, because `user_identities` is empty.
- The owner sets the secrets `PROD_DATABASE_URL` and `DEV_DATABASE_URL` (the session pooler URLs, because GitHub runners have no IPv6). The secret `RENDER_DEPLOY_HOOK_DEV` already exists.
