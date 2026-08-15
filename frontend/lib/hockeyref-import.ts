// Live import of last-season stats straight from hockey-reference — the same
// source the Players Calculator uses. The whole league sits in ONE table per
// page (skaters, goalies), so a refresh is 1–2 requests, admin-triggered (never
// per page-load). We pull games + points to power the FA demand engine.

import type { StatRow } from "./player-stats-import";

const UA = "Mozilla/5.0 (compatible; ProfiNHL-League/1.0)";

const cell = (row: string, stat: string): string | null => {
  const m = row.match(new RegExp(`data-stat="${stat}"[^>]*>(?:<[^>]+>)*([^<]+)`));
  return m ? m[1].trim() : null;
};

/** Parse a hockey-reference skater/goalie stats page into {name, gp, pts} rows,
 *  de-duped by name keeping the highest-GP row (a traded player's TOT line). */
export function parseHockeyRefSkaters(html: string): StatRow[] {
  const best = new Map<string, StatRow>();
  const rows = html.split(/<tr[ >]/).slice(1);
  for (const row of rows) {
    const name = cell(row, "name_display");
    if (!name || name === "Player") continue;
    const gp = Number(cell(row, "games") ?? 0);
    const g = Number(cell(row, "goals") ?? 0);
    const a = Number(cell(row, "assists") ?? 0);
    if (!gp && !g && !a) continue;
    const hits = Number(cell(row, "hits") ?? 0);
    const blocks = Number(cell(row, "blocks") ?? 0);
    const prev = best.get(name);
    if (!prev || gp > prev.gp) best.set(name, { name, gp, g, a, hits, blocks });
  }
  return [...best.values()];
}

export async function fetchHockeyRefStats(season = 2026): Promise<StatRow[]> {
  const url = `https://www.hockey-reference.com/leagues/NHL_${season}_skaters.html`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`hockey-reference returned HTTP ${res.status}`);
    return parseHockeyRefSkaters(await res.text());
  } finally {
    clearTimeout(timer);
  }
}
