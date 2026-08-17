// Player Calculator — informative projection of the four sim-critical params
// (CK, SC, PA, DF) from REAL performance, blending last season (20%) with the
// current season (80%). Values are estimates for GMs; the official ratings still
// come out after the season. In the off-season (no current-season games) the
// projection equals the current rating — nothing changes until real hockey is
// played and enough games are in the books (~game 10).
//
// This uses the EXACT lookup tables extracted from the ProfiNHL calculator
// (lib/calc-tables.ts): key = ROUND((lastStat/lastGP*20 + curStat/curGP*80)/100, 2),
// then a VLOOKUP-exact into the per-position table. Verified vs the workbook
// (McDavid 40GP·20G·36A → SC 71, PA 76). DF isn't projected here yet — its formula
// blends last-season DF with a shots-against-based defensive rating we don't import.

import { prisma } from "./prisma";
import {
  sc_F, sc_D, pa_F, pa_D, ck_F, ck_D,
  df_sh_F, df_sh_D, df_pm_F, df_pm_D, df_blk_F, df_blk_D, df_tg_F, df_tg_D, df_pts_F, df_pts_D,
  type CalcTable,
} from "./calc-tables";

export const LAST_WEIGHT = 0.2;
export const CUR_WEIGHT = 0.8;
export const ACTIVATE_AT_GP = 10; // real season "counts" once players have ~10 games
export const SEASON_GAMES = 82;   // reference full season for the games-missed penalty

/** Games-missed rating penalty: a player who sits out chunks of the season doesn't
 *  fully earn his projection. Missed ≥25% → −1, ≥50% → −2, ≥75% → −3. */
export function gamesMissedPenalty(gp: number, seasonGames = SEASON_GAMES): number {
  if (!gp || gp <= 0 || seasonGames <= 0) return 0;
  const missed = Math.max(0, (seasonGames - gp) / seasonGames);
  if (missed >= 0.75) return 3;
  if (missed >= 0.50) return 2;
  if (missed >= 0.25) return 1;
  return 0;
}

type Pos = "F" | "D";
const posOf = (position: string | null): Pos =>
  /\bD\b/.test((position ?? "").toUpperCase()) || ((position ?? "").toUpperCase().includes("D") && !/[CW]/.test((position ?? "").toUpperCase())) ? "D" : "F";

const SPEC = [
  { key: "ck", last: "lastSeasonHits", cur: "curSeasonHits", F: ck_F, D: ck_D },
  { key: "sc", last: "lastSeasonG", cur: "curSeasonG", F: sc_F, D: sc_D },
  { key: "pa", last: "lastSeasonA", cur: "curSeasonA", F: pa_F, D: pa_D },
] as const;
type ParamKey = "ck" | "sc" | "pa" | "df";

const rate = (stat: number | null | undefined, gp: number | null | undefined) =>
  gp && gp > 0 ? (stat ?? 0) / gp : null;

// bounds cache so an out-of-range key clamps to the table's min/max param
const bounds = new WeakMap<CalcTable, { lo: number; hi: number }>();
function tableBounds(t: CalcTable) {
  let b = bounds.get(t);
  if (!b) { const ks = Object.keys(t).map(Number); b = { lo: Math.min(...ks), hi: Math.max(...ks) }; bounds.set(t, b); }
  return b;
}
/** VLOOKUP-exact on cents key, clamped to the table's range (the tables are contiguous). */
function lookup(t: CalcTable, ratePerGame: number): number {
  const cents = Math.round(ratePerGame * 100);
  const { lo, hi } = tableBounds(t);
  return t[Math.max(lo, Math.min(hi, cents))];
}
/** VLOOKUP-exact on an already-integer key, clamped to range. */
function lookupKey(t: CalcTable, key: number): number {
  const { lo, hi } = tableBounds(t);
  return t[Math.max(lo, Math.min(hi, Math.round(key)))];
}

// DF composite weights per position (sum 100): SH-usage, +/-, take/give, blocks.
const DF_W = { F: { sh: 65, pm: 10, tg: 5, blk: 20 }, D: { sh: 55, pm: 10, tg: 5, blk: 30 } } as const;

export type DFInputs = {
  gp: number; shToi: number; teamShToi: number; plusMinus: number; blocks: number; tk: number; gv: number; currentDF: number;
};
/** The calculator's exact DF pipeline: usage/PK-share + blocks + +/- + take-give →
 *  composite → current-season DF rating → blended 80/20 with the existing DF → cap. */
export function projectDF(pos: Pos, i: DFInputs): number | null {
  if (!i.gp || i.gp <= 0 || !i.teamShToi || i.teamShToi <= 0 || i.currentDF == null) return null;
  const t = pos === "D"
    ? { sh: df_sh_D, pm: df_pm_D, blk: df_blk_D, tg: df_tg_D, pts: df_pts_D }
    : { sh: df_sh_F, pm: df_pm_F, blk: df_blk_F, tg: df_tg_F, pts: df_pts_F };
  const shRatio = i.shToi / i.teamShToi;                    // player PK-time share
  const blkPG = i.blocks / i.gp;
  const tgRatio = i.gv > 0 ? i.tk / i.gv : (i.tk > 0 ? 7 : 0);
  const CU = lookupKey(t.sh, Math.round(shRatio * 100));
  const CY = lookupKey(t.pm, Math.round(i.plusMinus));
  const DD = lookupKey(t.blk, Math.round(blkPG * 100));
  const DI = lookupKey(t.tg, Math.round(tgRatio * 100));
  const w = DF_W[pos];
  const DK = Math.round(((CU * w.sh + CY * w.pm + DI * w.tg + DD * w.blk) / 100) * 10) / 10; // 1 dp
  const DP = lookupKey(t.pts, Math.round(DK * 100));
  const DQ = Math.round((DP * 80 + i.currentDF * 20) / 100);
  return Math.min(DQ, 85);
}

export type ProjSkater = {
  id: number; name: string; position: string | null; teamId: number;
  gp: number; missedPenalty: number;
  actual: Record<ParamKey, number | null>;
  projected: Record<ParamKey, number | null>;
};

type Row = {
  id: number; name: string; position: string | null; teamId: number;
  ck: number | null; sc: number | null; pa: number | null; df: number | null;
} & Record<string, number | null | string>;

/** Project every skater from real form using the calculator's exact tables. */
export async function projectAllSkaters(): Promise<{ rows: ProjSkater[]; active: boolean }> {
  const players = await prisma.player.findMany({
    where: { isGoalie: false, rosterType: { in: ["NHL", "AHL"] } },
    select: {
      id: true, name: true, position: true, teamId: true,
      ck: true, sc: true, pa: true, df: true,
      lastSeasonGP: true, lastSeasonHits: true, lastSeasonG: true, lastSeasonA: true,
      curSeasonGP: true, curSeasonHits: true, curSeasonG: true, curSeasonA: true,
      curSeasonPM: true, curSeasonBlocks: true, curSeasonTK: true, curSeasonGV: true,
      curSeasonShToi: true, curSeasonTeamShToi: true,
    },
  }) as unknown as Row[];

  const active = players.filter((p) => Number(p.curSeasonGP ?? 0) >= ACTIVATE_AT_GP).length >= 50;

  const rows: ProjSkater[] = players.map((p) => {
    const pos = posOf(p.position);
    const actual: Record<ParamKey, number | null> = { ck: p.ck, sc: p.sc, pa: p.pa, df: p.df };
    const projected: Record<ParamKey, number | null> = { ck: p.ck, sc: p.sc, pa: p.pa, df: p.df };
    if (active) {
      for (const s of SPEC) {
        const lastR = rate(Number(p[s.last] ?? 0), Number(p.lastSeasonGP ?? 0));
        const curR = rate(Number(p[s.cur] ?? 0), Number(p.curSeasonGP ?? 0));
        let blended: number | null = null;
        if (lastR != null && curR != null) blended = LAST_WEIGHT * lastR + CUR_WEIGHT * curR;
        else blended = curR ?? lastR;
        if (blended == null) continue;
        projected[s.key] = lookup(pos === "D" ? s.D : s.F, blended);
      }
      // DF from the calculator's exact PK-usage/blocks/+-/take-give pipeline
      const dfProj = projectDF(pos, {
        gp: Number(p.curSeasonGP ?? 0),
        shToi: Number(p.curSeasonShToi ?? 0),
        teamShToi: Number(p.curSeasonTeamShToi ?? 0),
        plusMinus: Number(p.curSeasonPM ?? 0),
        blocks: Number(p.curSeasonBlocks ?? 0),
        tk: Number(p.curSeasonTK ?? 0),
        gv: Number(p.curSeasonGV ?? 0),
        currentDF: Number(p.df ?? 0),
      });
      if (dfProj != null) projected.df = dfProj;
    }
    // games-missed penalty: discount each projected param when the player sat out
    // a big chunk of the season (only applies once the season is live/active).
    const gp = Number(p.curSeasonGP ?? 0);
    const missedPenalty = active ? gamesMissedPenalty(gp) : 0;
    if (missedPenalty > 0) {
      for (const k of ["ck", "sc", "pa", "df"] as ParamKey[]) {
        if (projected[k] != null) projected[k] = Math.max(20, (projected[k] as number) - missedPenalty);
      }
    }
    return { id: p.id, name: p.name, position: p.position, teamId: p.teamId, gp, missedPenalty, actual, projected };
  });

  return { rows, active };
}

/** Direct exact projection for one player's stats — used for spot-checks / API. */
export function projectParam(param: "ck" | "sc" | "pa", pos: Pos, lastStat: number, lastGP: number, curStat: number, curGP: number): number {
  const s = SPEC.find((x) => x.key === param)!;
  const lastR = lastGP > 0 ? lastStat / lastGP : 0;
  const curR = curGP > 0 ? curStat / curGP : 0;
  const blended = LAST_WEIGHT * lastR + CUR_WEIGHT * curR;
  return lookup(pos === "D" ? s.D : s.F, blended);
}
