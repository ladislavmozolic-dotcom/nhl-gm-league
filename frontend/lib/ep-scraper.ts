/**
 * EliteProspects scraper bridge for the UNHL server.
 *
 * Direct fetch() calls to EP return HTTP 403 (Cloudflare Bot Management).
 * Python's urllib with a browser User-Agent gets through on the VPS host —
 * we call a tiny Python HTTP server (ep-scraper-server.py) running on the host
 * via http://host.docker.internal:3333/scrape (accessible from Docker container).
 *
 * The Python server runs outside Docker (on the VPS host) so it uses the host's
 * Python 3.14 which has a different TLS fingerprint that Cloudflare accepts.
 *
 * Usage:
 *   const result = await scrapeEpPlayer("https://www.eliteprospects.com/player/526036");
 *   if (result.success && result.season2627) { ... }
 */

export type EpSeason2627 = {
  teamName: string | null;
  leagueName: string | null;
  leagueUrlPath: string | null;
  gp: number;
  g: number;
  a: number;
  pts: number;
  pim: number;
  pm: number | null;
  gaa: number | null;
  svp: number | null;
  w: number | null;
  l: number | null;
  so: number | null;
};

export type EpPlayerResult = {
  success: true;
  epId: number;
  name: string;
  position: string;
  currentTeam: string | null;
  currentLeague: string | null;
  season2627: EpSeason2627 | null;
} | {
  success: false;
  error: string;
};

// The EP scraper server runs on the VPS host outside Docker.
// Docker containers can reach the host via host.docker.internal on Linux with --add-host
// OR via the docker bridge gateway IP (172.17.0.1 by default).
// We try host.docker.internal first, fall back to the Docker bridge gateway.
const EP_SCRAPER_URLS = [
  "http://host.docker.internal:3333/scrape",
  "http://172.17.0.1:3333/scrape",
  "http://172.18.0.1:3333/scrape",
  // In development (local Mac), the server may also run on localhost
  "http://127.0.0.1:3333/scrape",
];

/**
 * Scrape an EliteProspects player page and return 2026-27 season data.
 *
 * @param epUrl - Full EP URL like https://www.eliteprospects.com/player/526036
 * @param timeoutMs - Max time for the request (default 20s)
 */
export async function scrapeEpPlayer(
  epUrl: string,
  timeoutMs = 20_000
): Promise<EpPlayerResult> {
  if (!epUrl) return { success: false, error: "No epUrl provided" };

  const encodedUrl = encodeURIComponent(epUrl.trim());

  for (const base of EP_SCRAPER_URLS) {
    try {
      const res = await fetch(`${base}?url=${encodedUrl}`, {
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const parsed = (await res.json()) as EpPlayerResult;
      return parsed;
    } catch {
      // try next URL
      continue;
    }
  }

  return { success: false, error: "EP scraper server not reachable (tried all endpoints)" };
}

/**
 * Map an EP leagueName/leagueUrlPath to a known UNHL WorldLeague code.
 * Falls back to the raw leagueName if not recognised.
 */
export function mapEpLeagueToCode(leagueName: string | null, leagueUrlPath: string | null): string {
  if (!leagueName && !leagueUrlPath) return "UNKNOWN";

  const urlSlug = (leagueUrlPath ?? "").replace("/league/", "").toLowerCase();
  const name = (leagueName ?? "").toLowerCase();

  const MAP: Record<string, string> = {
    liiga: "LIIGA",
    khl: "KHL",
    vhl: "VHL",
    mhl: "MHL",
    shl: "SHL",
    nhl: "NHL",
    ahl: "AHL",
    echl: "ECHL",
    ohl: "OHL",
    whl: "WHL",
    qmjhl: "QMJHL",
    ncaa: "NCAA",
    "cze-extraliga": "CZE",
    "cze-1": "CZE-1",
    del: "DEL",
    hockeyallsvenskan: "HAS",
    "u20-sm-sarja": "FIN-U20",
    "liiga-u20": "FIN-U20",
    "u20-sm": "FIN-U20",
    mestis: "MESTIS",
    "russia-jr": "RUS-JR",
    "russia-3": "RUS-3",
    poland: "POL",
    "czech-2": "CZE-2",
    slovakia: "SVK",
    "elite-jr": "SHL-JR",
    "j20-nationell": "SHL-JR",
  };

  for (const [key, code] of Object.entries(MAP)) {
    if (urlSlug.includes(key) || name.includes(key)) return code;
  }

  // Fallback: use the EP leagueName directly (uppercased, max 20 chars)
  return (leagueName ?? "UNKNOWN").toUpperCase().slice(0, 20);
}
