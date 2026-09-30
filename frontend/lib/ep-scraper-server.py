#!/usr/bin/env python3
"""
Tiny local HTTP server that proxies EliteProspects scraping requests.
Listens on 127.0.0.1:3333 and is called by the Next.js Docker container via
http://host.docker.internal:3333/scrape?url=<epUrl>

Run as a systemd service or via the deploy script.
Usage: python3 ep-scraper-server.py
"""

import json
import re
import ssl
import sys
import time
import random
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

_ssl_ctx_noverify = ssl.create_default_context()
_ssl_ctx_noverify.check_hostname = False
_ssl_ctx_noverify.verify_mode = ssl.CERT_NONE

PRO_LEAGUES = {"Liiga", "KHL", "VHL", "MHL", "SHL", "CZE", "DEL", "NHL", "AHL",
               "ECHL", "OHL", "WHL", "QMJHL", "NCAA", "SM-sarja", "Mestis",
               "U20 SM-sarja", "Liiga U20"}


def ep_id_from_url(url: str):
    m = re.search(r'/player/(\d+)', url)
    return m.group(1) if m else None


def fetch_ep_player(url: str, retries: int = 2):
    ep_id = ep_id_from_url(url)
    if not ep_id:
        return {"success": False, "error": "Cannot extract EP ID from URL"}

    fetch_url = url

    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(fetch_url, headers=HEADERS)
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    html = resp.read().decode("utf-8", errors="replace")
            except Exception:
                with urllib.request.urlopen(req, timeout=15, context=_ssl_ctx_noverify) as resp:
                    html = resp.read().decode("utf-8", errors="replace")
            break
        except urllib.error.HTTPError as e:
            if e.code == 404 and attempt == 0:
                fetch_url = f"https://www.eliteprospects.com/player/{ep_id}/player"
                time.sleep(0.5 + random.random())
                continue
            return {"success": False, "error": f"HTTP {e.code}: {e.reason}"}
        except Exception as e:
            if attempt < retries:
                time.sleep(1 + random.random())
                continue
            return {"success": False, "error": str(e)}

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
        player_pos = pos_raw.get("abbreviation", "")
    else:
        player_pos = str(pos_raw) if pos_raw else ""

    edges = initial_stats.get("playerStats", {}).get("edges", [])
    stats_2627 = [
        e for e in edges
        if e.get("season", {}).get("slug") == "2026-2027"
        and e.get("statsType") == "default"
        and e.get("regularStats") is not None
    ]

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
        return {
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
        recent = [e for e in edges if e.get("statsType") == "default"]
        recent.sort(key=lambda e: e.get("season", {}).get("startYear", 0), reverse=True)
        return {
            "success": True,
            "epId": int(ep_id),
            "name": player_name,
            "position": player_pos,
            "currentTeam": recent[0].get("teamName") if recent else None,
            "currentLeague": recent[0].get("leagueName") if recent else None,
            "season2627": None
        }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # silence access log

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/scrape":
            self.send_response(404)
            self.end_headers()
            return

        params = parse_qs(parsed.query)
        ep_url = params.get("url", [None])[0]
        if not ep_url:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"error":"missing url param"}')
            return

        result = fetch_ep_player(ep_url)
        body = json.dumps(result).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3333
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"EP Scraper Server running on http://0.0.0.0:{port}/scrape", flush=True)
    server.serve_forever()

