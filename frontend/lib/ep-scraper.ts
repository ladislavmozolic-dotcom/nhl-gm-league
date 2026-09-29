/**
 * EliteProspects scraper bridge for the UNHL server.
 *
 * Direct fetch() calls to EP return HTTP 403 (Cloudflare Bot Management).
 * Python's urllib with a browser User-Agent gets through → we spawn a tiny
 * Python helper script (`lib/ep-scraper.py`) on the server and collect its
 * JSON output via child_process.
 *
 * Usage:
 *   const result = await scrapeEpPlayer("https://www.eliteprospects.com/player/526036");
 *   if (result.success && result.season2627) { ... }
 */

import { exec } from "child_process";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

// Path to the Python scraper, resolved relative to this file's directory at runtime.
// In production the app lives at /app (inside Docker); in dev it's the repo root.
const SCRAPER_PATH = path.join(
  typeof __dirname !== "undefined" ? __dirname : process.cwd(),
  "ep-scraper.py"
);

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

/**
 * Scrape an EliteProspects player page and return 2026-27 season data.
 *
 * @param epUrl - Full EP URL like https://www.eliteprospects.com/player/526036
 * @param timeoutMs - Max time for the Python process (default 20s)
 */
export async function scrapeEpPlayer(
  epUrl: string,
  timeoutMs = 20_000
): Promise<EpPlayerResult> {
  if (!epUrl) return { success: false, error: "No epUrl provided" };

  try {
    const { stdout, stderr } = await execAsync(
      `python3 "${SCRAPER_PATH}" "${epUrl.trim()}"`,
      { timeout: timeoutMs }
    );

    if (stderr?.trim()) {
      console.warn("[ep-scraper] stderr:", stderr.trim());
    }

    const raw = stdout.trim();
    if (!raw) return { success: false, error: "Empty output from ep-scraper.py" };

    const parsed = JSON.parse(raw) as EpPlayerResult;
    return parsed;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ep-scraper] Error:", msg);
    return { success: false, error: msg };
  }
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
