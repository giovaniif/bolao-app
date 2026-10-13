# ADR 0006: Web Push reminders driven by pg_cron

Status: accepted, 2026-10-13.

## Decision

- The web is an installable PWA with a service worker that shows Web Push messages (VAPID).
- The API sends three reminders per round: new round, 1 day before close and 10 minutes before close.
- Supabase `pg_cron` with `pg_net` calls `POST /api/internal/notifications/tick` every minute. A shared secret in `X-Cron-Secret` protects it.
- `notification_log` keys each send by bolão, round, kind and close time, so each reminder sends at most once. A moved close time re-arms the reminders. A new round is announced only once.

## Why

- Render's free plan sleeps (ADR 0005), so an in-process timer would miss the 10-minute reminder.
- GitHub Actions schedules drift by many minutes. `pg_cron` runs next to the data and wakes the API.

## Consequences

- iOS delivers push only to the app installed on the Home Screen (iOS 16.4+). The UI tells iPhone users to install it.
- `webpush-go` adds `mailto:` to the subject. The sender strips a configured `mailto:`, because Apple rejects `mailto:mailto:` with 403.
