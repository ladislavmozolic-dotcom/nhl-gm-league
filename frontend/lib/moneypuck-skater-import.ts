// MoneyPuck advanced skater totals — the data the SC/PA V1 model needs that the NHL
// box score lacks: individual xGoals (ixG), primary vs secondary assists, PP primary
// assists, and on-ice goals-for (for assist involvement). Three seasons so SC/PA can
// weight 55/30/15 by recency. icetime is TOTAL seconds for the season.
//
// CSV: moneypuck.com/moneypuck/playerData/seasonSummary/{year}/regular/skaters.csv
// One row per (player, situation). We read situation "all" (totals) + "5on4" (PP).

import { prisma } from "./prisma";
import { cleanName } from "./playerName";

const UA = "Mozilla/5.0 (compatible; ProfiNHL-League/1.0)";
export const MP_SEASONS = [2025, 2024, 2023] as const; // 25-26, 24-25, 23-24

const SPECIAL: Record<string, string> = { "ø": "o", "æ": "ae", "œ": "oe", "ß": "ss", "đ": "d", "ł": "l", "ð": "d", "þ": "th" };
function key(name: string): string {
  return cleanName(name).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[øæœßđłðþ]/g, (c) => SPECIAL[c] ?? c).replace(/[^a-z]/g, "");
}

type MpRow = { gp: number; toi: number; g: number; ixg: number; a1: number; a2: number; sh: number; ong: number; ppa1: number };

function parseCsv(text: string): string[][] {
  return text.trim().split(/\r?\n/).map((line) => line.split(","));
}

/** Fetch one season, return a name-key → MpRow map (all-situation totals + PP a1). */
async function fetchSeason(year: number): Promise<Map<string, MpRow>> {
  const res = await fetch(`https://moneypuck.com/moneypuck/playerData/seasonSummary/${year}/regular/skaters.csv`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`MoneyPuck ${year} HTTP ${res.status}`);
  const rows = parseCsv(await res.text());
  const head = rows[0];
  const col = (name: string) => head.indexOf(name);
  const iName = col("name"), iSit = col("situation"), iGP = col("games_played"), iTOI = col("icetime");
  const iG = col("I_F_goals"), iXG = col("I_F_xGoals"), iA1 = col("I_F_primaryAssists"), iA2 = col("I_F_secondaryAssists");
  const iSh = col("I_F_shotsOnGoal"), iOnG = col("OnIce_F_goals");
  const num = (r: string[], i: number) => { const v = Number(r[i]); return Number.isFinite(v) ? v : 0; };
  const out = new Map<string, MpRow>();
  for (const r of rows.slice(1)) {
    const sit = r[iSit];
    if (sit !== "all" && sit !== "5on4") continue;
    const k = key(r[iName]);
    if (!k) continue;
    let m = out.get(k);
    if (!m) { m = { gp: 0, toi: 0, g: 0, ixg: 0, a1: 0, a2: 0, sh: 0, ong: 0, ppa1: 0 }; out.set(k, m); }
    if (sit === "all") {
      m.gp = num(r, iGP); m.toi = num(r, iTOI); m.g = num(r, iG); m.ixg = num(r, iXG);
      m.a1 = num(r, iA1); m.a2 = num(r, iA2); m.sh = num(r, iSh); m.ong = num(r, iOnG);
    } else { // 5on4 — PP primary assists only
      m.ppa1 = num(r, iA1);
    }
  }
  return out;
}

/** Import MoneyPuck skater totals for MP_SEASONS into Player.mpSkater (name-matched). */
export async function importMoneyPuckSkaters(): Promise<{ seasons: Record<number, number>; matched: number }> {
  const seasonMaps: Record<number, Map<string, MpRow>> = {};
  for (const y of MP_SEASONS) seasonMaps[y] = await fetchSeason(y);

  const players = await prisma.player.findMany({ where: { isGoalie: false }, select: { id: true, name: true } });
  // full-name key → player id, unambiguous only (skip name collisions like the imports before)
  const byKey = new Map<string, number>(); const dup = new Set<string>();
  for (const p of players) { const k = key(p.name); if (byKey.has(k)) dup.add(k); else byKey.set(k, p.id); }

  const seasons: Record<number, number> = {};
  for (const y of MP_SEASONS) seasons[y] = seasonMaps[y].size;

  let matched = 0;
  for (const p of players) {
    const k = key(p.name);
    if (dup.has(k)) continue;
    const blob: Record<string, MpRow> = {};
    for (const y of MP_SEASONS) { const m = seasonMaps[y].get(k); if (m && m.toi > 0) blob[String(y)] = m; }
    if (Object.keys(blob).length === 0) continue;
    await prisma.player.update({ where: { id: p.id }, data: { mpSkater: blob } });
    matched++;
  }
  return { seasons, matched };
}
