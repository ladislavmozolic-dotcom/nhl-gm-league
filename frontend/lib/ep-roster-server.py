#!/usr/bin/env python3
"""
EP Roster Scraper Server — runs on VPS host (outside Docker) on port 3336.

Endpoints:
  GET /roster?url=<ep-team-url>
    Scrapes an EP team page and returns all player EP URLs + basic info.
    Used by world-import-khl.ts to get KHL team rosters.

  GET /health
    Returns {"ok": true}

Run as systemd service ep-roster-scraper.service
"""

import json, re, ssl, sys, time, random, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

EP_BASE = "https://www.eliteprospects.com"


def fetch_html(url: str) -> str | None:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception:
        # SSL fallback
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        try:
            with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception as e:
            return None


def extract_next_data(html: str) -> dict:
    m = re.search(r'id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
    if not m:
        return {}
    try:
        return json.loads(m.group(1))
    except Exception:
        return {}


def scrape_team_roster(team_url: str) -> dict:
    """Scrape a KHL/European team roster from EP team page."""
    html = fetch_html(team_url)
    if not html:
        return {"success": False, "error": "Failed to fetch page"}

    data = extract_next_data(html)
    if not data:
        return {"success": False, "error": "No __NEXT_DATA__"}

    pp = data.get("props", {}).get("pageProps", {})

    # Extract roster from rosterList.tableData.edges
    roster_list = pp.get("rosterList", {})
    table_data = roster_list.get("tableData", {}) if isinstance(roster_list, dict) else {}
    edges = table_data.get("edges", []) if isinstance(table_data, dict) else []

    players = []
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        pl = edge.get("player", {})
        if not pl:
            continue

        ep_path = pl.get("eliteprospectsUrlPath", "")
        if not ep_path:
            continue

        name = pl.get("name", "")
        ep_id_m = re.search(r"/player/(\d+)", ep_path)
        ep_id = ep_id_m.group(1) if ep_id_m else ""

        pos_raw = pl.get("position", {})
        if isinstance(pos_raw, dict):
            position = pos_raw.get("shortName", pos_raw.get("abbreviation", ""))
        else:
            position = str(pos_raw) if pos_raw else ""

        players.append({
            "epUrl": ep_path,
            "name": name,
            "position": position,
            "epId": ep_id,
        })

    # Also check statsTournament for player-level season stats (may not exist for current season)
    team_name = ""
    team_page = pp.get("teamPage", {})
    if isinstance(team_page, dict):
        team_name = team_page.get("name", "")

    return {
        "success": True,
        "teamName": team_name,
        "players": players,
        "count": len(players),
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silence access log

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/health":
            self._json({"ok": True})
            return

        if parsed.path == "/roster":
            team_url = params.get("url", [None])[0]
            if not team_url:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error":"missing url param"}')
                return
            result = scrape_team_roster(team_url)
            self._json(result)
            return

        self.send_response(404)
        self.end_headers()

    def _json(self, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3336
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"EP Roster Scraper Server running on :{port}", flush=True)
    server.serve_forever()
