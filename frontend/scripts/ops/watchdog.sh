#!/usr/bin/env bash
# Every 10 minutes (install.sh). Checks the live site, the league clock, the
# nightly backup and disk space, and e-mails the admin — at most once per 6 h
# per problem, plus a "recovered" mail when it clears.
set -uo pipefail
OPS="$(cd "$(dirname "$0")" && pwd)"
STATE=/var/lib/unhl-watchdog
mkdir -p "$STATE"
problems=()

probe() { health=$(curl -s -m 20 -w '\n%{http_code}' https://unhl.eu/api/health); code=$(echo "$health" | tail -1); }
probe
# one retry — a deploy restart makes the site blink for a few seconds
if [ "$code" != 200 ]; then sleep 45; probe; fi
if [ "$code" = 000 ]; then problems+=("site-down|unhl.eu does not respond at all (container/Caddy down?)")
elif [ "$code" != 200 ]; then
  body=$(echo "$health" | head -1)
  case "$body" in
    *db-down*) problems+=("db-down|The app is up but cannot reach the database") ;;
  esac
  case "$body" in *sim-overdue*) problems+=("sim-overdue|Tonight's 20:30 sim has not run (check /var/log/unhl-cron.log)") ;; esac
  case "$body" in *calendar-stuck*) problems+=("calendar-stuck|League date did not roll over after midnight") ;; esac
  case "$body" in *'"problems"'*) ;; *) problems+=("site-error|/api/health returned HTTP $code") ;; esac
fi

latest=/opt/unhl-backups/latest.dump
if [ ! -e "$latest" ] || [ $(( $(date +%s) - $(stat -L -c %Y "$latest") )) -gt $((26*3600)) ]; then
  problems+=("backup-stale|No successful DB backup in the last 26 hours")
fi

disk=$(df --output=pcent / | tail -1 | tr -dc 0-9)
if [ "$disk" -ge 90 ]; then problems+=("disk-full|Root disk is ${disk}% full (try: docker builder prune -f)"); fi

now=$(date +%s)
active=()
for p in "${problems[@]}"; do
  id=${p%%|*}; msg=${p#*|}; active+=("$id")
  f="$STATE/$id"
  if [ ! -e "$f" ] || [ $((now - $(cat "$f"))) -gt $((6*3600)) ]; then
    "$OPS/alert.sh" "ALERT: $id" "$msg

Time: $(date -u) · Host: $(hostname)" && echo "$now" > "$f"
  fi
done
# anything that was alerting but is no longer → "recovered"
for f in "$STATE"/*; do
  [ -e "$f" ] || continue
  id=$(basename "$f")
  if [[ ! " ${active[*]:-} " =~ " $id " ]]; then
    "$OPS/alert.sh" "Recovered: $id" "The '$id' problem cleared at $(date -u)." ; rm -f "$f"
  fi
done
