#!/usr/bin/env python3
"""
EliteProspects scraper that works from datacenter IPs.
Uses python urllib with browser User-Agent (gets 200 OK where Node.js fetch gets 403).
Extracts 2026-2027 season stats from __NEXT_DATA__ JSON embedded in the EP player page.

Usage:
  python3 ep-scraper.py <epUrl> [epId]
  e.g.: python3 ep-scraper.py https://www.eliteprospects.com/player/526036 526036

Output: JSON to stdout, with structure:
{
  "success": true,
  "epId": 526036,
  "name": "Aron Kiviharju",
  "position": "D",
  "currentTeam": "HIFK",
  "currentLeague": "Liiga",
  "season2627": {
    "teamName": "HIFK",
    "leagueName": "Liiga",
    "leagueUrlPath": "/league/liiga",
    "gp": 2, "g": 0, "a": 1, "pts": 1, "pim": 0, "pm": -2,
    "gaa": null, "svp": null, "w": null
  }
}
"""

import sys
import json
import re
import urllib.request
import time
import random

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

def ep_id_from_url(url: str):
    m = re.search(r'/player/(\d+)', url)
    return m.group(1) if m else None

def fetch_ep_player(url: str, retries: int = 2):
    ep_id = ep_id_from_url(url)
    if not ep_id:
        return {"success": False, "error": "Cannot extract EP ID from URL"}

    # Ensure URL has at least /player/{id}/slug form (EP may redirect bare IDs)
    fetch_url = url if url.count('/') >= 5 else url

    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(fetch_url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8", errors="replace")
            break
        except urllib.error.HTTPError as e:
            if e.code == 404 and attempt == 0:
                # Try with a dummy slug appended
                fetch_url = f"https://www.eliteprospects.com/player/{ep_id}/player"
                time.sleep(0.5 + random.random())
                continue
            return {"success": False, "error": f"HTTP {e.code}: {e.reason}"}
        except Exception as e:
            if attempt < retries:
                time.sleep(1 + random.random())
                continue
            return {"success": False, "error": str(e)}

    # Extract __NEXT_DATA__
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
    if not m:
        return {"success": False, "error": "No __NEXT_DATA__ found in page"}

    try:
        data = json.loads(m.group(1))
    except Exception as e:
        return {"success": False, "error": f"JSON parse error: {e}"}

    page_props = data.get("props", {}).get("pageProps", {})
    player_data = page_props.get("playerData", {}).get("player", {})
    initial_stats = page_props.get("initialLeagueStats", {})

    player_name = player_data.get("name") or player_data.get("fullName", "")
    pos_raw = player_data.get("position")
    if isinstance(pos_raw, dict):
        player_pos = player_data.get("latestPlayerStats", {}).get("playerRole") or pos_raw.get("abbreviation", "")
    else:
        player_pos = str(pos_raw) if pos_raw else ""

    edges = initial_stats.get("playerStats", {}).get("edges", [])

    # Filter to 2026-2027, statsType=default (actual stats, not projected)
    stats_2627 = [
        e for e in edges
        if e.get("season", {}).get("slug") == "2026-2027"
        and e.get("statsType") == "default"
        and e.get("regularStats") is not None
    ]

    # Pick the "primary" league entry: prefer non-international leagues
    # Sort: prefer league entries where leagueName in known pro leagues
    PRO_LEAGUES = {"Liiga", "KHL", "VHL", "MHL", "SHL", "CZE", "DEL", "NHL", "AHL",
                   "ECHL", "OHL", "WHL", "QMJHL", "NCAA", "SM-sarja", "Mestis",
                   "U20 SM-sarja", "Liiga U20"}

    def score(e):
        ln = e.get("leagueName", "")
        if ln in PRO_LEAGUES:
            return 2
        if "U20" in ln or "Jr" in ln.lower():
            return 1
        return 0

    stats_2627.sort(key=score, reverse=True)

    if stats_2627:
        best = stats_2627[0]
        rs = best.get("regularStats") or {}
        result = {
            "success": True,
            "epId": int(ep_id),
            "name": player_name,
            "position": player_pos,
            "currentTeam": best.get("teamName"),
            "currentLeague": best.get("leagueName"),
            "season2627": {
                "teamName": best.get("teamName"),
                "leagueName": best.get("leagueName"),
                "leagueUrlPath": best.get("league", {}).get("eliteprospectsUrlPath"),
                "gp": rs.get("GP") or 0,
                "g": rs.get("G") or 0,
                "a": rs.get("A") or 0,
                "pts": rs.get("PTS") or 0,
                "pim": rs.get("PIM") or 0,
                "pm": rs.get("PM"),
                "gaa": rs.get("GAA"),
                "svp": rs.get("SVP"),
                "w": rs.get("W"),
                "l": rs.get("L"),
                "so": rs.get("SO"),
            }
        }
    else:
        # No 2026-27 stats yet – still return current team from most recent edge
        recent = [e for e in edges if e.get("statsType") == "default"]
        recent.sort(key=lambda e: e.get("season", {}).get("startYear", 0), reverse=True)
        current_team = recent[0].get("teamName") if recent else None
        current_league = recent[0].get("leagueName") if recent else None
        result = {
            "success": True,
            "epId": int(ep_id),
            "name": player_name,
            "position": player_pos,
            "currentTeam": current_team,
            "currentLeague": current_league,
            "season2627": None
        }

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: ep-scraper.py <epUrl>"}))
        sys.exit(1)

    url = sys.argv[1]
    result = fetch_ep_player(url)
    print(json.dumps(result))
