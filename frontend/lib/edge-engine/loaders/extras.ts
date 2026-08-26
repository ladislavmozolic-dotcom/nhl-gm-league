// Injury + fights loaders. Like EDGE, neither has a clean public per-player API (the NHL API
// exposes no injury reason / games-missed, and no fights count), and the spec forbids a GP proxy
// for DU (scratches ≠ injuries) and majors≠fights for FG. So both take a small CSV you fill from
// a public injury tracker / hockeyfights-style source. Present → DU/FG compute; absent → flagged.

import type { InjurySeason } from "../types";

function rows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const h = lines[0].split(",").map((x) => x.trim());
  return lines.slice(1).map((l) => { const c = l.split(","); return Object.fromEntries(h.map((k, i) => [k, (c[i] ?? "").trim()])); });
}
const int = (v?: string) => { const x = parseInt(v ?? "", 10); return Number.isFinite(x) ? x : 0; };

/** injury.csv: playerId,season,gamesMissedInjury,eligibleGames[,longTermEvents] (a row per season). */
export function loadInjuryCsv(text: string): Map<string, InjurySeason[]> {
  const m = new Map<string, InjurySeason[]>();
  for (const r of rows(text)) {
    if (!r.playerId || !r.season) continue;
    const arr = m.get(r.playerId) ?? [];
    arr.push({ season: r.season, gamesMissedInjury: int(r.gamesMissedInjury), eligibleGames: int(r.eligibleGames) || 82, longTermEvents: int(r.longTermEvents) });
    m.set(r.playerId, arr);
  }
  // most-recent-first (DU weights 50/30/20)
  for (const arr of m.values()) arr.sort((a, b) => b.season.localeCompare(a.season));
  return m;
}

/** fights.csv: playerId,fights (3-season total). Injected onto the player's newest season so FG
 *  computes fights/82 over the real 3-year GP. */
export function loadFightsCsv(text: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows(text)) if (r.playerId) m.set(r.playerId, int(r.fights));
  return m;
}
