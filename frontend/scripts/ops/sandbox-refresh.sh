#!/usr/bin/env bash
# (Re)create the TEST-MODE database as a full copy of the live league, schedule and all.
#
#   LOCAL (Mac):   ./scripts/ops/sandbox-refresh.sh
#       clones DATABASE_URL from .env  ->  <dbname>_sandbox  (same Postgres server)
#   then:          SANDBOX_DATABASE_URL=postgresql://…/<dbname>_sandbox npm run dev:sandbox   (port 3001)
#
# Safe by design: it only ever READS the live DB (pg_dump) and only DROPS the
# *_sandbox database; it refuses to run if the target name doesn't end in _sandbox.
set -euo pipefail
cd "$(dirname "$0")/../.."
LIVE_URL="${LIVE_DATABASE_URL:-$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')}"
[ -n "$LIVE_URL" ] || { echo "✗ no DATABASE_URL"; exit 1; }

# split postgresql://user:pass@host:port/db[?query]
base="${LIVE_URL%%\?*}"; live_db="${base##*/}"; server="${base%/*}"
sandbox_db="${live_db}_sandbox"
case "$sandbox_db" in *_sandbox) ;; *) echo "✗ refusing: target must end in _sandbox"; exit 1;; esac
[ "$sandbox_db" != "$live_db" ] || { echo "✗ target equals live DB"; exit 1; }

echo "▶ Cloning $live_db → $sandbox_db"
psql "$server/postgres" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS \"$sandbox_db\" WITH (FORCE)" -c "CREATE DATABASE \"$sandbox_db\""
pg_dump "$base" --no-owner --no-privileges | psql "$server/$sandbox_db" -v ON_ERROR_STOP=0 -q >/dev/null

n=$(psql "$server/$sandbox_db" -Atc 'select count(*) from "Game"')
echo "✓ Sandbox ready ($n games copied)."
echo "  Run:  SANDBOX_DATABASE_URL=\"$server/$sandbox_db\" npm run dev:sandbox   # http://localhost:3001"
