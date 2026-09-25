#!/usr/bin/env bash
# Runs on the admin's Mac (launchd, daily 10:00 + on wake if missed). Copies the
# newest production DB dump off the server into ~/UNHL-Backups, keeps 30.
# Install: see eu.unhl.backup-pull.plist in this folder.
set -uo pipefail
DEST="$HOME/UNHL-Backups"
mkdir -p "$DEST"
name=$(ssh -o BatchMode=yes -o ConnectTimeout=20 root@2.29.8.109 'basename "$(readlink -f /opt/unhl-backups/latest.dump)"') || {
  osascript -e 'display notification "Server nedostupný – záloha sa nestiahla" with title "UNHL záloha"'; exit 1; }
if [ ! -e "$DEST/$name" ]; then
  scp -q -o BatchMode=yes root@2.29.8.109:"/opt/unhl-backups/$name" "$DEST/$name.part" && mv "$DEST/$name.part" "$DEST/$name" || {
    osascript -e 'display notification "Stiahnutie zálohy zlyhalo" with title "UNHL záloha"'; exit 1; }
fi
ls -1t "$DEST"/unhl-*.dump 2>/dev/null | tail -n +31 | xargs -r rm -f
echo "$(date) ok $name"
