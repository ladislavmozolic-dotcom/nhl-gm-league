#!/usr/bin/env bash
# SERVER: overwrite the TEST instance (test.unhl.eu, formerly profi.unhl.eu) with a
# full copy of the LIVE league — rosters, schedule, standings, settings, everything.
#
#   ./scripts/ops/sandbox-clone-to-test.sh            (from /opt/nhl-gm-league/frontend)
#
# The live DB is only READ (pg_dump). The test DB is backed up first, then replaced.
# Override container names if yours differ:
#   LIVE_DB_CT=frontend-db-1  TEST_DB_CT=nhl-gm-league-profi-db_profi-1  TEST_APP_CT=nhl-gm-league-profi-app
set -euo pipefail
LIVE_DB_CT="${LIVE_DB_CT:-frontend-db-1}"
TEST_DB_CT="${TEST_DB_CT:-nhl-gm-league-profi-db_profi-1}"
TEST_APP_CT="${TEST_APP_CT:-nhl-gm-league-profi-app}"
[ "$LIVE_DB_CT" != "$TEST_DB_CT" ] || { echo "✗ live and test DB container are the same"; exit 1; }

# pg credentials come from each container's own env (POSTGRES_USER / POSTGRES_DB)
pgenv() { docker exec "$1" sh -c 'echo "$POSTGRES_USER $POSTGRES_DB"'; }
read -r LU LDB < <(pgenv "$LIVE_DB_CT"); read -r TU TDB < <(pgenv "$TEST_DB_CT")
echo "live: $LIVE_DB_CT/$LDB    test: $TEST_DB_CT/$TDB"

mkdir -p /opt/unhl-backups
bk="/opt/unhl-backups/test-before-clone-$(date -u +%Y%m%d-%H%M).dump"
echo "▶ Backing up the test DB → $bk"
docker exec "$TEST_DB_CT" pg_dump -U "$TU" -Fc "$TDB" > "$bk"

echo "▶ Stopping test app, replacing test DB with a copy of live"
docker stop "$TEST_APP_CT" >/dev/null 2>&1 || true
docker exec "$TEST_DB_CT" psql -U "$TU" -d postgres -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS \"$TDB\" WITH (FORCE)" -c "CREATE DATABASE \"$TDB\""
docker exec "$LIVE_DB_CT" pg_dump -U "$LU" --no-owner --no-privileges "$LDB" \
  | docker exec -i "$TEST_DB_CT" psql -U "$TU" -d "$TDB" -q >/dev/null

echo "▶ Starting test app"
docker start "$TEST_APP_CT" >/dev/null
echo "✓ Test league = copy of live ($(docker exec "$TEST_DB_CT" psql -U "$TU" -d "$TDB" -Atc 'select count(*) from "Game"') games)."
