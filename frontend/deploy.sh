#!/usr/bin/env bash
# Update the LIVE league to the latest code. Safe to run mid-season — the database
# and uploaded files live in Docker volumes and are NOT touched by a rebuild.
#
#   ./deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ Pulling latest code…"
git pull --ff-only

echo "▶ Building the app image…"
docker compose build app

echo "▶ Applying any database schema changes (prisma db push)…"
docker compose run --rm app npx prisma db push

echo "▶ Restarting services…"
docker compose up -d

echo "✓ Deployed. Live at https://$(grep -E '^DOMAIN=' .env | cut -d= -f2)"
