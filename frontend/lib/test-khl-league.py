import urllib.request, re, json, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Test KHL league stats page
for url in [
    "https://www.eliteprospects.com/league/khl/stats/2026-2027",
    "https://www.eliteprospects.com/league/khl/stats/2026-2027?page=1",
]:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        try:
            r = urllib.request.urlopen(req, timeout=15)
        except Exception:
            r = urllib.request.urlopen(req, timeout=15, context=ctx)
        html = r.read().decode("utf-8", errors="replace")
        m = re.search(r'id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
        if m:
            d = json.loads(m.group(1))
            pp = d.get("props", {}).get("pageProps", {})
            edges = pp.get("initialLeagueStats", {}).get("playerStats", {}).get("edges", [])
            total = pp.get("initialLeagueStats", {}).get("playerStats", {}).get("totalCount")
            print(f"URL: {url}")
            print(f"  Players on page: {len(edges)}, totalCount: {total}")
            if edges:
                p = edges[0]
                rs = p.get("regularStats") or {}
                print(f"  Sample: {p.get('playerName')} | {p.get('teamName')} | GP={rs.get('GP')} G={rs.get('G')} A={rs.get('A')}")
                print(f"  Player EP URL: {p.get('player', {}).get('eliteprospectsUrlPath')}")
        else:
            print(f"URL: {url} → No __NEXT_DATA__ (HTTP {r.status})")
            print("  Snippet:", html[:200])
    except Exception as e:
        print(f"URL: {url} → Error: {e}")
    print()
