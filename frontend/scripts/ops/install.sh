#!/usr/bin/env bash
# Idempotently installs the ops cron jobs (backup + watchdog) on the server.
# Run once after deploy:  sudo ./scripts/ops/install.sh
set -euo pipefail
OPS="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$OPS"/*.sh
( crontab -l 2>/dev/null | grep -v 'scripts/ops/' ;
  echo "30 3 * * * $OPS/backup-db.sh >> /var/log/unhl-backup.log 2>&1"
  echo "*/10 * * * * $OPS/watchdog.sh >> /var/log/unhl-watchdog.log 2>&1"
) | crontab -
echo "Installed:"; crontab -l | grep 'scripts/ops/'
