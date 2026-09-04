// MoneyPuck advanced skater totals — the data the Next Gen Parameters need that the
// NHL box score lacks: individual xGoals (ixG), primary vs secondary assists, PP
// primary assists, on-ice goals-for (for assist involvement), and the 5-on-5 / PK
// situational splits Passing and Defense are built from. Three seasons so ratings
// can weight recent play more heavily. icetime is TOTAL seconds for the season.
//
// Player CSV: moneypuck.com/moneypuck/playerData/seasonSummary/{year}/regular/skaters.csv
// One row per (player, situation). We read "all" (totals), "5on4" (PP primary
// assists), "5on5" (Passing's 5v5 split + Defense's 5v5 on-ice xGA), and "4on5"
// (Defense's penalty-kill on-ice xGA).
//
// Team CSV: moneypuck.com/moneypuck/playerData/seasonSummary/{year}/regular/teams.csv
// One row per (team, situation) — team-wide xGoalsAgainst + iceTime, same situations.
// Defense needs TRUE relative xGA (on-ice rate vs. the rate the rest of the roster
// allows without this player on the ice), which the player CSV alone can't give —
// off-ice = (team total − this player's on-ice) / (team icetime − his icetime).

import { prisma } from "./prisma";
import { cleanName } from "./playerName";

const UA = "Mozilla/5.0 (compatible; ProfiNHL-League/1.0)";
export const MP_SEASONS = [2025, 2024, 2023] as const; // 25-26, 24-25, 23-24

const SPECIAL: Record<string, string> = { "ø": "o", "æ": "ae", "œ": "oe", "ß": "ss", "đ": "d", "ł": "l", "ð": "d", "þ": "th" };
function key(name: string): string {
  return cleanName(name).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[øæœßđłðþ]/g, (c) => SPECIAL[c] ?? c).replace(/[^a-z]/g, "");
}

type MpRow = {
  gp: number; toi: number; g: number; ixg: number; a1: number; a2: number; sh: number; ong: number; ppa1: number;
  toi5v5: number; a1_5v5: number; a2_5v5: number; onIceAxg5v5: number; // 5-on-5 split (Passing, Defense)
  toi4v5: number; onIceAxg4v5: number;                                 // penalty-kill split (Defense)
  offIceAxg5v5: number; offIceToi5v5: number;                          // team-without-him, 5v5 (Defense: true Rel)
  offIceAxg4v5: number; offIceToi4v5: number;                          // team-without-him, PK (Defense: true Rel)
};

function parseCsv(text: string): string[][] {
  return text.trim().split(/\r?\n/).map((line) => line.split(","));
}

type TeamTotals = { xga5v5: number; toi5v5: number; xga4v5: number; toi4v5: number };

/** Team-wide xGoalsAgainst + iceTime by situation, one season. */
async function fetchTeamTotals(year: number): Promise<Map<string, TeamTotals>> {
  const res = await fetch(`https://moneypuck.com/moneypuck/playerData/seasonSummary/${year}/regular/teams.csv`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`MoneyPuck teams ${year} HTTP ${res.status}`);
  const rows = parseCsv(await res.text());
  const head = rows[0];
  const col = (name: string) => head.indexOf(name);
  const iTeam = col("team"), iSit = col("situation"), iTOI = col("iceTime"), iXga = col("xGoalsAgainst");
  const num = (r: string[], i: number) => { const v = Number(r[i]); return Number.isFinite(v) ? v : 0; };
  const out = new Map<string, TeamTotals>();
  for (const r of rows.slice(1)) {
    const sit = r[iSit];
    if (sit !== "5on5" && sit !== "4on5") continue;
    const team = r[iTeam];
    let t = out.get(team);
    if (!t) { t = { xga5v5: 0, toi5v5: 0, xga4v5: 0, toi4v5: 0 }; out.set(team, t); }
    if (sit === "5on5") { t.xga5v5 = num(r, iXga); t.toi5v5 = num(r, iTOI); }
    else { t.xga4v5 = num(r, iXga); t.toi4v5 = num(r, iTOI); }
  }
  return out;
}

/** Fetch one season, return a name-key → MpRow map. */
async function fetchSeason(year: number): Promise<Map<string, MpRow>> {
  const [res, teams] = await Promise.all([
    fetch(`https://moneypuck.com/moneypuck/playerData/seasonSummary/${year}/regular/skaters.csv`, { headers: { "User-Agent": UA } }),
    fetchTeamTotals(year),
  ]);
  if (!res.ok) throw new Error(`MoneyPuck ${year} HTTP ${res.status}`);
  const rows = parseCsv(await res.text());
  const head = rows[0];
  const col = (name: string) => head.indexOf(name);
  const iName = col("name"), iTeam = col("team"), iSit = col("situation"), iGP = col("games_played"), iTOI = col("icetime");
  const iG = col("I_F_goals"), iXG = col("I_F_xGoals"), iA1 = col("I_F_primaryAssists"), iA2 = col("I_F_secondaryAssists");
  const iSh = col("I_F_shotsOnGoal"), iOnG = col("OnIce_F_goals"), iOnAxg = col("OnIce_A_xGoals");
  const num = (r: string[], i: number) => { const v = Number(r[i]); return Number.isFinite(v) ? v : 0; };
  const blank = (): MpRow => ({ gp: 0, toi: 0, g: 0, ixg: 0, a1: 0, a2: 0, sh: 0, ong: 0, ppa1: 0, toi5v5: 0, a1_5v5: 0, a2_5v5: 0, onIceAxg5v5: 0, toi4v5: 0, onIceAxg4v5: 0, offIceAxg5v5: 0, offIceToi5v5: 0, offIceAxg4v5: 0, offIceToi4v5: 0 });
  const out = new Map<string, MpRow>();
  for (const r of rows.slice(1)) {
    const sit = r[iSit];
    if (sit !== "all" && sit !== "5on4" && sit !== "5on5" && sit !== "4on5") continue;
    const k = key(r[iName]);
    if (!k) continue;
    let m = out.get(k);
    if (!m) { m = blank(); out.set(k, m); }
    if (sit === "all") {
      m.gp = num(r, iGP); m.toi = num(r, iTOI); m.g = num(r, iG); m.ixg = num(r, iXG);
      m.a1 = num(r, iA1); m.a2 = num(r, iA2); m.sh = num(r, iSh); m.ong = num(r, iOnG);
    } else if (sit === "5on4") { // PP primary assists only
      m.ppa1 = num(r, iA1);
    } else if (sit === "5on5" || sit === "4on5") {
      const toi = num(r, iTOI), onAxg = num(r, iOnAxg);
      const t = teams.get(r[iTeam]);
      // off-ice = (team total − this player's on-ice) / (team icetime − his icetime) —
      // the rate the rest of the roster allows in this situation without him on the ice.
      if (sit === "5on5") {
        m.toi5v5 = toi; m.onIceAxg5v5 = onAxg;
        if (t) { m.offIceAxg5v5 = Math.max(0, t.xga5v5 - onAxg); m.offIceToi5v5 = Math.max(0, t.toi5v5 - toi); }
      } else {
        m.toi4v5 = toi; m.onIceAxg4v5 = onAxg;
        if (t) { m.offIceAxg4v5 = Math.max(0, t.xga4v5 - onAxg); m.offIceToi4v5 = Math.max(0, t.toi4v5 - toi); }
      }
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
