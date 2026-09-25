#!/usr/bin/env bash
# Daily production DB backup (cron 03:30 UTC, see install.sh). Custom-format
# pg_dump (compressed, restorable with pg_restore), 14 newest kept. The Mac pulls
# the newest one off-server every day (scripts/ops/mac/pull-backup.sh).
#
# Restore:  cat unhl-XXXX.dump | docker compose exec -T db pg_restore -U profinhl -d profinhl --clean --if-exists
set -uo pipefail
DIR=/opt/unhl-backups
KEEP=14
APP=/opt/nhl-gm-league/frontend
OPS="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DIR"
out="$DIR/unhl-$(date -u +%Y%m%d-%H%M).dump"
tag="${1:-daily}"
[ "$tag" != daily ] && out="${out%.dump}-$tag.dump"

if ! (cd "$APP" && docker compose exec -T db pg_dump -U profinhl -Fc profinhl) > "$out.part"; then
  rm -f "$out.part"; "$OPS/alert.sh" "Backup FAILED" "pg_dump exited non-zero on $(hostname) at $(date -u)."; exit 1
fi
size=$(stat -c %s "$out.part")
# a real dump is ~5 MB; anything under 1 MB means an empty/broken DB
if [ "$size" -lt 1000000 ]; then
  mv "$out.part" "$out.suspect"; "$OPS/alert.sh" "Backup suspiciously small" "Dump is only $size bytes: $out.suspect"; exit 1
fi
mv "$out.part" "$out"
ln -sfn "$out" "$DIR/latest.dump"
# rotate daily dumps only — pre-deploy dumps are rotated separately (keep 5)
ls -1t "$DIR"/unhl-*.dump 2>/dev/null | grep -v -- '-predeploy' | tail -n +$((KEEP+1)) | xargs -r rm -f
ls -1t "$DIR"/unhl-*-predeploy.dump 2>/dev/null | tail -n +6 | xargs -r rm -f
echo "$(date -u +%FT%TZ) ok $out $size"
