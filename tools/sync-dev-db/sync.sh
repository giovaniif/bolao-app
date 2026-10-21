#!/usr/bin/env bash
# shellcheck disable=SC2016
set -euo pipefail

missing=()
[ -n "${PROD_DATABASE_URL:-}" ] || missing+=(PROD_DATABASE_URL)
[ -n "${DEV_DATABASE_URL:-}" ] || missing+=(DEV_DATABASE_URL)
if [ "${#missing[@]}" -gt 0 ]; then
  echo "sync-dev-db: set ${missing[*]}" >&2
  exit 2
fi
if [ "$PROD_DATABASE_URL" = "$DEV_DATABASE_URL" ]; then
  echo "sync-dev-db: PROD_DATABASE_URL and DEV_DATABASE_URL are the same database" >&2
  exit 2
fi

image="${PG_CLIENT_IMAGE:-postgres:17}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

pg() {
  docker run --rm --network host \
    --user "$(id -u):$(id -g)" \
    -e PROD_DATABASE_URL -e DEV_DATABASE_URL \
    -v "$work:/work" -v "$here:/scripts:ro" \
    "$image" sh -c "$1"
}

echo "sync-dev-db: dump prod (schema public)"
pg 'pg_dump "$PROD_DATABASE_URL" --schema=public --no-owner --no-privileges --format=custom --file=/work/prod.dump'

echo "sync-dev-db: convert the dump to SQL"
pg 'pg_restore --schema=public --no-owner --no-privileges --file=/work/prod.sql /work/prod.dump'
sed -i '/^SET transaction_timeout/d' "$work/prod.sql"

echo "sync-dev-db: replace dev schema public and scrub it, in one transaction"
pg 'psql "$DEV_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 --single-transaction -f /scripts/reset.sql -f /work/prod.sql -f /scripts/scrub.sql'

if [ -n "${RENDER_DEPLOY_HOOK_DEV:-}" ]; then
  echo "sync-dev-db: redeploy the dev API so its migrations run on the new data"
  curl -fsS -X POST -o /dev/null "$RENDER_DEPLOY_HOOK_DEV"
fi

echo "sync-dev-db: done"
