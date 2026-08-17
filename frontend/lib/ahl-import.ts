// Last-season AHL games played from theahl.com (HockeyTech feed) — the missing
// half of a player's "did he play last season" picture, used by the post-season
// roster reconciliation. Season 90 = 2025-26 Regular.

import { prisma } from "./prisma";

const AHL = "https://lscluster.hockeytech.com/feed/index.php?feed=modulekit&client_code=ahl&key=50c2cd9b5e18e390&fmt=json&lang=en";
const UA = "Mozilla/5.0 (compatible; ProfiNHL-League/1.0)";
const AHL_SEASON = 90;

// Non-decomposing special letters NFD leaves alone.
const SPECIAL: Record<string, string> = { "ø": "o", "æ": "ae", "œ": "oe", "ß": "ss", "đ": "d", "ł": "l", "ð": "d", "þ": "th" };
function words(name: string): string[] {
  const flat = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[øæœßđłðþ]/g, (c) => SPECIAL[c] ?? c);
  return flat.split(/[^a-z]+/).filter(Boolean);
}
/** Full normalized key: all name words joined (last-name + first initial fallback
 *  handled separately by the caller). */
function key(name: string): string {
  return words(name).join("");
}
/** Last name + first initial — catches nickname / spelling variants (Cal↔Callahan,
 *  Dom↔Domenic, Artyom↔Artem) when it's unambiguous. */
function lastInitial(name: string): string | null {
  const w = words(name);
  return w.length >= 2 ? `${w[w.length - 1]}|${w[0][0]}` : null;
}

export type AhlGpRow = { name: string; gp: number };

export async function fetchAhlGp(seasonId = AHL_SEASON): Promise<AhlGpRow[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(`${AHL}&view=skaters&season_id=${seasonId}&limit=3000`, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`AHL feed HTTP ${res.status}`);
    const rows = (await res.json())?.SiteKit?.Skaters ?? [];
    return rows.map((r: any) => ({ name: r.name ?? `${r.first_name} ${r.last_name}`.trim(), gp: Number(r.games_played ?? 0) }));
  } finally { clearTimeout(timer); }
}

// AHL skater scoring (theahl.com feed only populates G/A/shots/PIM/PP/GP — TOI,
// hits and blocks come back 0, so Edge can only derive scoring params for the AHL).
export type AhlStatRow = { name: string; gp: number; g: number; a: number; shots: number; pim: number; ppG: number };
export async function fetchAhlSkaterStats(seasonId: number): Promise<AhlStatRow[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(`${AHL}&view=skaters&season_id=${seasonId}&limit=3000`, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`AHL feed HTTP ${res.status}`);
    const rows = (await res.json())?.SiteKit?.Skaters ?? [];
    return rows.map((r: any) => ({
      name: r.name ?? `${r.first_name} ${r.last_name}`.trim(),
      gp: Number(r.games_played ?? 0), g: Number(r.goals ?? 0), a: Number(r.assists ?? 0),
      shots: Number(r.shots ?? 0), pim: Number(r.penalty_minutes ?? 0), ppG: Number(r.power_play_goals ?? 0),
    }));
  } finally { clearTimeout(timer); }
}

/** Write AHL scoring into the cur/last real-season fields for matched players. */
export async function importAhlSkaterStats(rows: AhlStatRow[], target: "cur" | "last") {
  // AHL-roster players only — never overwrite an NHL player's NHL stats
  const players = await prisma.player.findMany({ where: { rosterType: "AHL", isGoalie: false }, select: { id: true, name: true } });
  const full = new Map<string, number>(); const li = new Map<string, number>(); const liDup = new Set<string>();
  for (const p of players) {
    full.set(key(p.name), p.id);
    const k = lastInitial(p.name);
    if (k) { if (li.has(k)) liDup.add(k); else li.set(k, p.id); }
  }
  let matched = 0; const seen = new Set<number>();
  for (const row of rows) {
    let id = full.get(key(row.name));
    if (id == null) { const k = lastInitial(row.name); if (k && !liDup.has(k) && li.has(k)) id = li.get(k)!; }
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    const d = target === "cur"
      ? { curSeasonGP: row.gp, curSeasonG: row.g, curSeasonA: row.a, curSeasonShots: row.shots, curSeasonPim: row.pim, curSeasonPpG: row.ppG }
      : { lastSeasonGP: row.gp, lastSeasonG: row.g, lastSeasonA: row.a, lastSeasonShots: row.shots, lastSeasonPim: row.pim, lastSeasonPpG: row.ppG };
    await prisma.player.update({ where: { id }, data: d });
    matched++;
  }
  return { total: rows.length, matched };
}

export async function importAhlGp(rows: AhlGpRow[]) {
  const players = await prisma.player.findMany({ select: { id: true, name: true } });
  const full = new Map<string, number>();
  const li = new Map<string, number>();
  const liDup = new Set<string>();
  for (const p of players) {
    full.set(key(p.name), p.id);
    const k = lastInitial(p.name);
    if (k) { if (li.has(k)) liDup.add(k); else li.set(k, p.id); }
  }
  let matched = 0, fuzzy = 0;
  const seen = new Set<number>();
  for (const row of rows) {
    let id = full.get(key(row.name));
    if (id == null) {
      const k = lastInitial(row.name);
      if (k && !liDup.has(k) && li.has(k)) { id = li.get(k)!; fuzzy++; } // unambiguous last+initial
    }
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    await prisma.player.update({ where: { id }, data: { lastSeasonAhlGP: row.gp } });
    matched++;
  }
  return { total: rows.length, matched, fuzzy };
}
