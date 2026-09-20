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
// First-name nickname variants (MoneyPuck's formal names vs. our shorter/alt forms)
// → canonical form — same map as lib/player-stats-import.ts's FIRST_ALIAS. Without
// this, "Jacob Middleton" (our DB) never matches MoneyPuck's "Jake Middleton" and
// silently keeps whatever stale value he had before any recompute — which then
// looks like a real (but wrong) result sitting next to genuinely recomputed players.
const FIRST_ALIAS: Record<string, string> = {
  mitchell: "mitch", alexander: "alex", aleksander: "alex", alexei: "alex", aleksei: "alex", alexey: "alex", aleksey: "alex",
  william: "will", zachary: "zach", zack: "zach", joshua: "josh", matthew: "matt", benjamin: "ben",
  cameron: "cam", fyodor: "fedor", nicholas: "nick", nicklaus: "nick", nikolai: "nik", nikolaj: "nik",
  maxime: "max", maximilian: "max", maxim: "max", maksim: "max", samuel: "sam", jacob: "jake", joseph: "joe",
  michael: "mike", mikey: "mike", christopher: "chris", theodore: "theo",
  dmitri: "dmitry", dmitrii: "dmitry", dmitriy: "dmitry", dima: "dmitry",
  yegor: "egor", jegor: "egor", evgenii: "evgeny", evgeni: "evgeny", sergey: "sergei", andrey: "andrei",
  daniil: "danil", grigori: "grigory", grigorii: "grigory", vasili: "vasily", vasiliy: "vasily",
};
function key(name: string): string {
  const norm = cleanName(name).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[øæœßđłðþ]/g, (c) => SPECIAL[c] ?? c);
  const words = norm.split(/[^a-z]+/).filter(Boolean);
  if (words.length && FIRST_ALIAS[words[0]]) words[0] = FIRST_ALIAS[words[0]];
  return words.join("");
}

type MpRow = {
  gp: number; toi: number; g: number; ixg: number; a1: number; a2: number; sh: number; ong: number; ppa1: number;
  toi5v5: number; a1_5v5: number; a2_5v5: number; onIceAxg5v5: number; onIceFxg5v5: number; // 5-on-5 split (Passing, Defense)
  toi4v5: number; onIceAxg4v5: number;                                 // penalty-kill split (Defense)
  offIceAxg5v5: number; offIceToi5v5: number;                          // team-without-him, 5v5 (Defense: true Rel)
  offIceAxg4v5: number; offIceToi4v5: number;                          // team-without-him, PK (Defense: true Rel)
  onIceGa5v5: number; offIceGa5v5: number;                             // actual (not expected) on-ice/off-ice GA, 5v5
  hits: number; tk: number; gv: number; blk: number; onGaAll: number;  // box-score counts (UNHL calculator recompute)
  penalties: number; pim: number; penaltiesDrawn: number; pimDrawn: number; // Penalty & powerplay drawing stats
  gameScore: number; shifts: number;
  shotAttempts: number; unblockedAttempts: number; missedShots: number; blockedAttempts: number;
  reboundsCreated: number; reboundGoals: number; freeze: number;
  dZoneGiveaways: number;
  hdShots: number; mdShots: number; ldShots: number;
  hdGoals: number; mdGoals: number; ldGoals: number;
  hdXg: number; mdXg: number; ldXg: number;
  oZoneShiftStarts: number; dZoneShiftStarts: number; neutralZoneShiftStarts: number; flyShiftStarts: number;
  faceoffsWon: number; faceoffsLost: number;
  onIceXgPct: number; offIceXgPct: number;
  onIceCorsiPct: number; offIceCorsiPct: number;
  onIceFenwickPct: number; offIceFenwickPct: number;
};

function parseCsv(text: string): string[][] {
  return text.trim().split(/\r?\n/).map((line) => line.split(","));
}

type TeamTotals = { xga5v5: number; toi5v5: number; xga4v5: number; toi4v5: number; ga5v5: number };

/** Team-wide xGoalsAgainst/goalsAgainst + iceTime by situation, one season. */
async function fetchTeamTotals(year: number): Promise<Map<string, TeamTotals>> {
  const res = await fetch(`https://moneypuck.com/moneypuck/playerData/seasonSummary/${year}/regular/teams.csv`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`MoneyPuck teams ${year} HTTP ${res.status}`);
  const rows = parseCsv(await res.text());
  const head = rows[0];
  const col = (name: string) => head.indexOf(name);
  const iTeam = col("team"), iSit = col("situation"), iTOI = col("iceTime"), iXga = col("xGoalsAgainst"), iGa = col("goalsAgainst");
  const num = (r: string[], i: number) => { const v = Number(r[i]); return Number.isFinite(v) ? v : 0; };
  const out = new Map<string, TeamTotals>();
  for (const r of rows.slice(1)) {
    const sit = r[iSit];
    if (sit !== "5on5" && sit !== "4on5") continue;
    const team = r[iTeam];
    let t = out.get(team);
    if (!t) { t = { xga5v5: 0, toi5v5: 0, xga4v5: 0, toi4v5: 0, ga5v5: 0 }; out.set(team, t); }
    if (sit === "5on5") { t.xga5v5 = num(r, iXga); t.toi5v5 = num(r, iTOI); t.ga5v5 = num(r, iGa); }
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
  const iSh = col("I_F_shotsOnGoal"), iOnG = col("OnIce_F_goals"), iOnAxg = col("OnIce_A_xGoals"), iOnGa = col("OnIce_A_goals");
  const iHits = col("I_F_hits"), iTk = col("I_F_takeaways"), iGv = col("I_F_giveaways"), iBlk = col("shotsBlockedByPlayer");
  const iPen = col("penalties"), iPim = col("penalityMinutes"), iPenDrawn = col("penaltiesDrawn"), iPimDrawn = col("penalityMinutesDrawn");
  
  // Expanded MoneyPuck columns
  const iGameScore = col("gameScore"), iShifts = col("shifts");
  const iShotAtt = col("I_F_shotAttempts"), iUnblkAtt = col("I_F_unblockedShotAttempts"), iMissedSh = col("I_F_missedShots"), iBlkAtt = col("I_F_blockedShotAttempts");
  const iRebCr = col("I_F_rebounds"), iRebG = col("I_F_reboundGoals"), iFreeze = col("I_F_freeze");
  const iDzGv = col("I_F_dZoneGiveaways");
  const iHdS = col("I_F_highDangerShots"), iMdS = col("I_F_mediumDangerShots"), iLdS = col("I_F_lowDangerShots");
  const iHdG = col("I_F_highDangerGoals"), iMdG = col("I_F_mediumDangerGoals"), iLdG = col("I_F_lowDangerGoals");
  const iHdXg = col("I_F_highDangerxGoals"), iMdXg = col("I_F_mediumDangerxGoals"), iLdXg = col("I_F_lowDangerxGoals");
  const iOzStarts = col("I_F_oZoneShiftStarts"), iDzStarts = col("I_F_dZoneShiftStarts"), iNzStarts = col("I_F_neutralZoneShiftStarts"), iFlyStarts = col("I_F_flyShiftStarts");
  const iFoW = col("faceoffsWon"), iFoL = col("faceoffsLost");
  const iOnXgPct = col("onIce_xGoalsPercentage"), iOffXgPct = col("offIce_xGoalsPercentage");
  const iOnCorsi = col("onIce_corsiPercentage"), iOffCorsi = col("offIce_corsiPercentage");
  const iOnFenwick = col("onIce_fenwickPercentage"), iOffFenwick = col("offIce_fenwickPercentage");
  const iOnFxg = col("OnIce_F_xGoals");

  const num = (r: string[], i: number) => { const v = Number(r[i]); return Number.isFinite(v) ? v : 0; };
  const blank = (): MpRow => ({
    gp: 0, toi: 0, g: 0, ixg: 0, a1: 0, a2: 0, sh: 0, ong: 0, ppa1: 0,
    toi5v5: 0, a1_5v5: 0, a2_5v5: 0, onIceAxg5v5: 0, onIceFxg5v5: 0,
    toi4v5: 0, onIceAxg4v5: 0,
    offIceAxg5v5: 0, offIceToi5v5: 0, offIceAxg4v5: 0, offIceToi4v5: 0,
    onIceGa5v5: 0, offIceGa5v5: 0,
    hits: 0, tk: 0, gv: 0, blk: 0, onGaAll: 0,
    penalties: 0, pim: 0, penaltiesDrawn: 0, pimDrawn: 0,
    gameScore: 0, shifts: 0,
    shotAttempts: 0, unblockedAttempts: 0, missedShots: 0, blockedAttempts: 0,
    reboundsCreated: 0, reboundGoals: 0, freeze: 0,
    dZoneGiveaways: 0,
    hdShots: 0, mdShots: 0, ldShots: 0,
    hdGoals: 0, mdGoals: 0, ldGoals: 0,
    hdXg: 0, mdXg: 0, ldXg: 0,
    oZoneShiftStarts: 0, dZoneShiftStarts: 0, neutralZoneShiftStarts: 0, flyShiftStarts: 0,
    faceoffsWon: 0, faceoffsLost: 0,
    onIceXgPct: 0, offIceXgPct: 0,
    onIceCorsiPct: 0, offIceCorsiPct: 0,
    onIceFenwickPct: 0, offIceFenwickPct: 0,
  });

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
      m.hits = num(r, iHits); m.tk = num(r, iTk); m.gv = num(r, iGv); m.blk = num(r, iBlk);
      m.onGaAll = num(r, iOnGa); // same "OnIce_A_goals" column, this row is the all-situations one
      m.penalties = num(r, iPen);
      m.pim = num(r, iPim);
      m.penaltiesDrawn = num(r, iPenDrawn);
      m.pimDrawn = num(r, iPimDrawn);

      // Expanded columns
      m.gameScore = num(r, iGameScore);
      m.shifts = num(r, iShifts);
      m.shotAttempts = num(r, iShotAtt);
      m.unblockedAttempts = num(r, iUnblkAtt);
      m.missedShots = num(r, iMissedSh);
      m.blockedAttempts = num(r, iBlkAtt);
      m.reboundsCreated = num(r, iRebCr);
      m.reboundGoals = num(r, iRebG);
      m.freeze = num(r, iFreeze);
      m.dZoneGiveaways = num(r, iDzGv);
      m.hdShots = num(r, iHdS);
      m.mdShots = num(r, iMdS);
      m.ldShots = num(r, iLdS);
      m.hdGoals = num(r, iHdG);
      m.mdGoals = num(r, iMdG);
      m.ldGoals = num(r, iLdG);
      m.hdXg = num(r, iHdXg);
      m.mdXg = num(r, iMdXg);
      m.ldXg = num(r, iLdXg);
      m.oZoneShiftStarts = num(r, iOzStarts);
      m.dZoneShiftStarts = num(r, iDzStarts);
      m.neutralZoneShiftStarts = num(r, iNzStarts);
      m.flyShiftStarts = num(r, iFlyStarts);
      m.faceoffsWon = num(r, iFoW);
      m.faceoffsLost = num(r, iFoL);
      m.onIceXgPct = num(r, iOnXgPct);
      m.offIceXgPct = num(r, iOffXgPct);
      m.onIceCorsiPct = num(r, iOnCorsi);
      m.offIceCorsiPct = num(r, iOffCorsi);
      m.onIceFenwickPct = num(r, iOnFenwick);
      m.offIceFenwickPct = num(r, iOffFenwick);
    } else if (sit === "5on4") { // PP primary assists only
      m.ppa1 = num(r, iA1);
    } else if (sit === "5on5" || sit === "4on5") {
      const toi = num(r, iTOI), onAxg = num(r, iOnAxg);
      const t = teams.get(r[iTeam]);
      // off-ice = (team total − this player's on-ice) / (team icetime − his icetime) —
      // the rate the rest of the roster allows in this situation without him on the ice.
      if (sit === "5on5") {
        const onGa = num(r, iOnGa);
        m.toi5v5 = toi; m.onIceAxg5v5 = onAxg; m.onIceGa5v5 = onGa;
        m.onIceFxg5v5 = num(r, iOnFxg);
        if (t) {
          m.offIceAxg5v5 = Math.max(0, t.xga5v5 - onAxg); m.offIceToi5v5 = Math.max(0, t.toi5v5 - toi);
          m.offIceGa5v5 = Math.max(0, t.ga5v5 - onGa);
        }
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
