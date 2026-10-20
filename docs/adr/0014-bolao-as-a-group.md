# ADR 0014: A bolão is a group with roles per bolão

Status: accepted, 2026-10-20. Supersedes [ADR 0003](0003-multi-tenancy-by-bolao.md).

## Decision

- A bolão is a group of players. Many bolões are active at the same time.
- Every domain row still has a `bolao_id`. Domain routes move under `/api/boloes/:id/...`.
- Roles are per bolão: `owner`, `admin` and `participant`. A bolão has exactly one owner.
- `users.is_admin` becomes the platform admin. It moderates and corrects match data. It does not give access to a bolão.
- A user joins by invite code, by invite link, or from the public listing. An owner can require approval of each request.
- A bolão has at most 50 active members.
- Entry fees stay manual: the owner sets `amount_paid` per member.
- Login stays by username. Sign-up adds email (for password reset only), Sign in with Apple and Google.
- The scoring rules are the same for every bolão. The API serves them from the constants in `scoring.go`.

## Why

- Players want their own bolões with their friends. One global bolão does not allow it.
- Roles per bolão let an owner manage a bolão without access to other bolões.
- Login by username keeps every current login working.
- One set of rules keeps `SCORING.md` the only specification.

## Consequences

- Migration 008 backfills the current data once: the oldest admin owns each existing bolão, admins get `admin`, and every participant stays active.
- A membership middleware is the authorization boundary for bolão routes. Handlers do not check roles.
- The old routes stay as aliases until the web and the store apps use the new routes.
- A query without a `bolao_id` filter is still a bug.
