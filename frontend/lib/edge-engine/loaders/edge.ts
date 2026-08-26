// NHL EDGE loader.
//
// EDGE skating-tracking (top speed, 20+/22+ mph bursts, distance, shot speed) has NO clean
// public per-player JSON API — the nhl.com/edge app's data endpoints are CORS-locked. Per the
// spec's SK tier-1/tier-3 design, this loader takes a CSV you export/fill from nhl.com/edge
// (or a scouting sheet). Players present here get a real SK; everyone else stays flagged
// "NEEDS EDGE/scouting" — never a ProfiNHL value.
//
// CSV columns (header required; playerId = NHL id = MoneyPuck id = our nhlId):
//   playerId,name,maxSpeedMph,bursts20,bursts22,skatingMiles,shotSpeedMph
// Only maxSpeedMph is required for a usable SK; the rest sharpen it.

import type { EdgeData } from "../types";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = l.split(",");
    return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? "").trim()]));
  });
}

const n = (v: string | undefined) => { const x = parseFloat(v ?? ""); return Number.isFinite(x) ? x : undefined; };

/** Parse an EDGE CSV → Map keyed by playerId (and by lowercased name as a fallback join key). */
export function loadEdgeCsv(csvText: string): { byId: Map<string, EdgeData>; byName: Map<string, EdgeData> } {
  const byId = new Map<string, EdgeData>();
  const byName = new Map<string, EdgeData>();
  for (const r of parseCsv(csvText)) {
    const e: EdgeData = {
      maxSpeedMph: n(r.maxSpeedMph), bursts20: n(r.bursts20), bursts22: n(r.bursts22),
      skatingMiles: n(r.skatingMiles), shotSpeedMph: n(r.shotSpeedMph),
    };
    if (e.maxSpeedMph == null) continue; // no usable speed → skip
    if (r.playerId) byId.set(r.playerId, e);
    if (r.name) byName.set(r.name.toLowerCase(), e);
  }
  return { byId, byName };
}
