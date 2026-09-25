#!/usr/bin/env bash
# Send an ops alert e-mail via Resend. Usage: alert.sh "<subject>" "<body>"
# Reads RESEND_API_KEY + ALERT_EMAIL from the app's .env (never committed).
set -uo pipefail
ENV_FILE="${UNHL_ENV:-/opt/nhl-gm-league/frontend/.env}"
key=$(grep -E '^RESEND_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
to=$(grep -E '^ALERT_EMAIL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
if [ -z "$key" ] || [ -z "$to" ]; then echo "alert.sh: RESEND_API_KEY/ALERT_EMAIL missing — $1" >&2; exit 1; fi
payload=$(python3 -c 'import json,sys; print(json.dumps({"from":"Ultimate NHL <noreply@unhl.eu>","to":[sys.argv[1]],"subject":"[UNHL] "+sys.argv[2],"text":sys.argv[3]}))' "$to" "$1" "$2")
curl -fsS -X POST https://api.resend.com/emails -H "Authorization: Bearer $key" -H "Content-Type: application/json" -d "$payload" >/dev/null
