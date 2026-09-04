"use server";

// Edge Parameters engine (DB side). Builds each player's per-60 metric blend from
// real NHL/AHL stats, ranks them into percentiles within (league × position group),
// and composites those into Edge ratings. Skaters only for now.

import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { cleanName } from "./playerName";
import { per60, blend, percentileOf, ratingFromCurve, EDGE_COMPOSITES, EDGE_GOALIE_COMPOSITES, experienceFromAge, durabilityFromAvailability, leadershipFrom, EDGE_MO_DEFAULT } from "./edge-params";

const CUR_SEASON_GAMES = 82; // real season length reference for durability

const isDef = (pos = "") => /(^|\/)D(\/|$)/.test(pos) || pos === "D";

type Row = {
  id: number; name: string; position: string; league: string; teamCode: string | null;
  gp: number; mins: number; age: number | null; captaincy: string | null;
  curGP: number; lastGP: number; metrics: Record<string, number | null>;
};

export type EdgeRow = {
  playerId: number; name: string; position: string; posGroup: "F" | "D"; league: string; teamCode: string | null;
  ratings: Record<string, number>; // SC PA CK DF EN FO DI ST PH EX DU LD MO OV — absolute ability (engine)
  posPct?: Record<string, number>; // percentile within own position (analytics/UI): "Scoring 99th among D"
};

// per-60 rate metrics get regressed toward the position mean by sample reliability;
// direct measurements (ice time, weight, SH-TOI) do not.
const REGRESS_KEYS = new Set(["g60", "a60", "sh60", "gpg", "apg", "off60", "hit60", "blk60", "tk60", "gv60", "pm60", "pim60", "fo", "shpct", "gxg60", "a605v5", "oxga5v5", "oxgapk"]);
const REGRESS_K = 500; // minutes at which reliability = 0.5

/** Per-60 metric blend (80% current / 20% prior real season) for one player. */
function metricsFor(p: any): Record<string, number | null> {
  const cGP = p.curSeasonGP ?? 0, lGP = p.lastSeasonGP ?? 0;
  const cTOI = p.curSeasonToi ?? 0, lTOI = p.lastSeasonToi ?? 0;
  // Games-weighted recency blend: each season counts by its games played, cur ×4 so
  // two FULL seasons ≈ the old 80/20 — but a 1-game cur (Kevin Rooney: 1G/1GP) barely
  // registers instead of hijacking 80% of the rate. Regression then handles true
  // no-history rookies (tiny total sample).
  const RECENCY = 4;
  const blendGP = (cr: number | null, lr: number | null): number | null => {
    const wc = cGP * RECENCY, wl = lGP;
    if (cr != null && lr != null && wc + wl > 0) return (cr * wc + lr * wl) / (wc + wl);
    return cr != null ? cr : lr;
  };
  const rate = (cv: number, lv: number) => blendGP(cGP > 0 ? per60(cv, cTOI, cGP) : null, lGP > 0 ? per60(lv, lTOI, lGP) : null);
  const perGame = (cv: number, lv: number) => blendGP(cGP > 0 ? cv / cGP : null, lGP > 0 ? lv / lGP : null);
  const g60 = rate(p.curSeasonG ?? 0, p.lastSeasonG ?? 0);
  const a60 = rate(p.curSeasonA ?? 0, p.lastSeasonA ?? 0);
  const sh60 = rate(p.curSeasonShots ?? 0, p.lastSeasonShots ?? 0);
  const gpg = perGame(p.curSeasonG ?? 0, p.lastSeasonG ?? 0);
  const apg = perGame(p.curSeasonA ?? 0, p.lastSeasonA ?? 0);
  const gTot = blend(p.curSeasonG, p.lastSeasonG), shTot = blend(p.curSeasonShots, p.lastSeasonShots);
  return {
    g60, a60, sh60, gpg, apg, off60: (g60 ?? 0) + (a60 ?? 0),
    shpct: shTot > 0 ? gTot / shTot : null,
    hit60: rate(p.curSeasonHits ?? 0, p.lastSeasonHits ?? 0),
    blk60: rate(p.curSeasonBlocks ?? 0, p.lastSeasonBlocks ?? 0),
    tk60: rate(p.curSeasonTK ?? 0, p.lastSeasonTK ?? 0),
    gv60: rate(p.curSeasonGV ?? 0, p.lastSeasonGV ?? 0),
    pm60: rate(p.curSeasonPM ?? 0, p.lastSeasonPM ?? 0),
    pim60: rate(p.curSeasonPim ?? 0, p.lastSeasonPim ?? 0),
    shtoi: blend(p.curSeasonShToi, p.lastSeasonShToi),
    toi: blend(p.curSeasonToi, p.lastSeasonToi),
    wt: p.weight ?? null,
    // faceoffs only meaningful for players who take them (centres); wingers ~0
    fo: blend(p.curSeasonFoPct, p.lastSeasonFoPct),
    // NHL EDGE skating (Next Gen SK): speed-burst percentile (already 0-1) — the ONLY
    // burst stat NHL EDGE publishes (burstsOver20, no separate 18+/22+). NULL (not 0)
    // when the player has no EDGE tracking, so SK is simply skipped for him rather
    // than bottoming out.
    brst20: (() => {
      const es = (p.edgeSpeed as any) ?? {};
      const c = es.cur ?? {}, l = es.last ?? {};
      if (c.brst == null && l.brst == null) return null;
      return blend(c.brst, l.brst);
    })(),
    // Next Gen EXPERIENCE: career games played (career-to-date, not just cur/last
    // season) from the NHL API. NULL when the player has no imported careerGP yet.
    regGP: (p.careerGP as any)?.reg ?? null,
    poGP: (p.careerGP as any)?.po ?? null,
    // Next Gen SC/PA/DF sub-metrics — MoneyPuck situational splits.
    ...(() => {
      const w = mpWeighted(p.mpSkater);
      if (!w) return { gxg60: null, a605v5: null, oxga5v5: null, oxgapk: null };
      return {
        gxg60: per60Sec(w.g - w.ixg, w.toi),
        a605v5: per60Sec(w.a1_5v5 + w.a2_5v5, w.toi5v5),
        oxga5v5: per60Sec(w.onIceAxg5v5, w.toi5v5),
        oxgapk: per60Sec(w.onIceAxg4v5, w.toi4v5),
      };
    })(),
  };
}

const SEL = {
  id: true, name: true, position: true, rosterType: true, teamId: true, weight: true, age: true, captaincy: true,
  curSeasonGP: true, curSeasonToi: true, curSeasonG: true, curSeasonA: true, curSeasonShots: true, curSeasonGV: true,
  curSeasonHits: true, curSeasonBlocks: true, curSeasonTK: true, curSeasonPM: true, curSeasonPim: true,
  curSeasonShToi: true, curSeasonFoPct: true,
  lastSeasonGP: true, lastSeasonToi: true, lastSeasonG: true, lastSeasonA: true, lastSeasonShots: true,
  lastSeasonHits: true, lastSeasonBlocks: true, lastSeasonTK: true, lastSeasonGV: true, lastSeasonPM: true, lastSeasonPim: true,
  lastSeasonShToi: true, lastSeasonFoPct: true, edgeSpeed: true, mpSkater: true, careerGP: true,
} as const;

// ---- MoneyPuck situational blend (Next Gen: G-xG, 5v5 passing, on-ice xGA) --------
const MP_W: Record<string, number> = { "2025": 0.80, "2024": 0.20 }; // 2 seasons (25-26 / 24-25)

type MpWeighted = {
  g: number; ixg: number; toi: number; sh: number; a1: number; a2: number; ppa1: number; ong: number; gp: number;
  toi5v5: number; a1_5v5: number; a2_5v5: number; onIceAxg5v5: number; toi4v5: number; onIceAxg4v5: number;
};
/** 2-season recency-weighted MoneyPuck totals for one player (weights renormalised
 *  over the seasons actually present, so a rate = weighted goals / weighted TOI and a
 *  one-season player still gets a full-season sample for reliability). */
function mpWeighted(mp: any): MpWeighted | null {
  if (!mp) return null;
  const present = Object.keys(MP_W).filter((y) => mp[y]?.toi > 0);
  if (!present.length) return null;
  const totW = present.reduce((s, y) => s + MP_W[y], 0);
  const acc: MpWeighted = { g: 0, ixg: 0, toi: 0, sh: 0, a1: 0, a2: 0, ppa1: 0, ong: 0, gp: 0, toi5v5: 0, a1_5v5: 0, a2_5v5: 0, onIceAxg5v5: 0, toi4v5: 0, onIceAxg4v5: 0 };
  for (const y of present) { const w = MP_W[y] / totW, s = mp[y]; for (const k of Object.keys(acc) as (keyof MpWeighted)[]) acc[k] += (s[k] ?? 0) * w; }
  return acc;
}
/** Rate per 60 minutes from a season-total value and TOI in SECONDS. */
const per60Sec = (value: number, seconds: number): number | null => (seconds > 0 ? (value / seconds) * 3600 : null);


// ---- STHS-scale calibration ----------------------------------------------
// Edge's percentile engine centres every param at ~74 and lets scoring run to 99.
// STHS uses tighter, param- and position-specific baselines (SC forward-max ~74 /
// D-max ~61, DF D>F, overall 50-70). To make Edge *look and feed the engine like
// STHS*, quantile-map each Edge value onto the STHS distribution of the same param
// and position: a player keeps his Edge RANK (data-driven, live) but takes the STHS
// value at that rank. The within-position analytics percentile (posPct) is left
// untouched — that's the "99th among D" number the UI shows alongside.

const CAL_MAP: Record<string, string> = { SC: "sc", PA: "pa", CK: "ck", DF: "df", EN: "en", FO: "fo", DI: "di", ST: "st", PH: "ph", FG: "fg", PS: "ps", SK: "sk", EX: "ex", DU: "du", LD: "ld", OV: "overall" };
const GOALIE_CAL_MAP: Record<string, string> = { SC: "sc", RT: "rt", HS: "hs", AG: "ag", RB: "rb", EN: "en", SZ: "sz", EX: "ex", DU: "du", LD: "ld", OV: "overall" };

type Ref = Record<"F" | "D", Record<string, number[]>>;
type Stat = { mean: number; std: number; min: number; max: number };
function statsOf(a: number[]): Stat | null {
  if (!a.length) return null;
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  const std = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / a.length);
  return { mean, std, min: Math.min(...a), max: Math.max(...a) };
}
/** Affine map of an Edge value onto the STHS scale: keep the player's Edge distance
 *  from the mean (in std units) but re-express it with the STHS mean+spread. Output
 *  is a continuous Edge-derived number, NOT a copied STHS value; clamped to the STHS
 *  observed range so it never leaves the parameter's real bounds. */
function affine(raw: number, e: Stat, s: Stat): number {
  const z = e.std > 1e-9 ? (raw - e.mean) / e.std : 0;
  return Math.round(Math.max(s.min, Math.min(s.max, s.mean + z * s.std)));
}

/** STHS reference distributions (sorted), position-split, for the players in `where`. */
async function sthsSkaterRef(where: Prisma.PlayerWhereInput): Promise<Ref> {
  const rows = await prisma.player.findMany({ where, select: { position: true, skaterRating: { select: { sc: true, pa: true, ck: true, df: true, en: true, fo: true, di: true, st: true, ph: true, fg: true, sk: true, ps: true, ex: true, du: true, ld: true, overall: true } } } });
  const ref: Ref = { F: {}, D: {} };
  for (const g of ["F", "D"] as const) for (const k of Object.values(CAL_MAP)) ref[g][k] = [];
  for (const r of rows) {
    if (!r.skaterRating) continue;
    const g = isDef(r.position ?? "") ? "D" : "F";
    for (const k of Object.values(CAL_MAP)) { const v = (r.skaterRating as any)[k]; if (v != null) ref[g][k].push(v); }
  }
  for (const g of ["F", "D"] as const) for (const k of Object.values(CAL_MAP)) ref[g][k].sort((a, b) => a - b);
  return ref;
}

/** STHS goalie reference (sorted, single group — goalies aren't position-split). */
async function sthsGoalieRef(where: Prisma.PlayerWhereInput): Promise<Record<string, number[]>> {
  const rows = await prisma.player.findMany({ where, select: { goalieRating: { select: { sc: true, rt: true, hs: true, ag: true, rb: true, en: true, sz: true, ex: true, du: true, ld: true, overall: true } } } });
  const ref: Record<string, number[]> = {};
  for (const k of Object.values(GOALIE_CAL_MAP)) ref[k] = [];
  for (const r of rows) { if (!r.goalieRating) continue; for (const k of Object.values(GOALIE_CAL_MAP)) { const v = (r.goalieRating as any)[k]; if (v != null) ref[k].push(v); } }
  for (const k of Object.values(GOALIE_CAL_MAP)) ref[k].sort((a, b) => a - b);
  return ref;
}

function calibrateGoalies(rows: EdgeRow[], ref: Record<string, number[]>): EdgeRow[] {
  for (const [P, sk] of Object.entries(GOALIE_CAL_MAP)) {
    const es = statsOf(rows.map((r) => r.ratings[P]).filter((v): v is number => v != null));
    const ss = statsOf(ref[sk] ?? []);
    if (!es || !ss) continue;
    for (const r of rows) if (r.ratings[P] != null) r.ratings[P] = affine(r.ratings[P], es, ss);
  }
  return rows;
}

/** Rescale each row's ability ratings onto the STHS scale by an affine (mean+spread)
 *  transform, per parameter and position — Edge keeps its own live, continuous values,
 *  just centred and stretched to the STHS baseline for that param. */
function calibrateSkaters(rows: EdgeRow[], ref: Ref, map = CAL_MAP): EdgeRow[] {
  for (const g of ["F", "D"] as const) {
    const grpRows = rows.filter((r) => r.posGroup === g);
    for (const [P, sk] of Object.entries(map)) {
      const es = statsOf(grpRows.map((r) => r.ratings[P]).filter((v): v is number => v != null));
      const ss = statsOf(ref[g][sk] ?? []);
      if (!es || !ss) continue;
      for (const r of grpRows) if (r.ratings[P] != null) r.ratings[P] = affine(r.ratings[P], es, ss);
    }
  }
  return rows;
}

/** Compute Edge ratings for every skater in a league (default NHL). `calibrate`
 *  (default on) maps the absolute ability ratings onto the STHS value scale. */
export async function edgeRatings(league = "NHL", calibrate = true): Promise<EdgeRow[]> {
  const players = await prisma.player.findMany({ where: { rosterType: league, isGoalie: false }, select: SEL });
  const teams = await prisma.team.findMany({ select: { id: true, code: true } });
  const codeById = new Map(teams.map((t) => [t.id, t.code]));

  const minsOf = (p: any) => (p.curSeasonToi ?? 0) / 60 * (p.curSeasonGP ?? 0) + (p.lastSeasonToi ?? 0) / 60 * (p.lastSeasonGP ?? 0);
  const rows: Row[] = players.map((p) => ({
    id: p.id, name: cleanName(p.name), position: p.position ?? "", league,
    teamCode: p.teamId != null ? codeById.get(p.teamId) ?? null : null,
    gp: (p.curSeasonGP ?? 0) + (p.lastSeasonGP ?? 0), mins: minsOf(p),
    age: p.age ?? null, captaincy: p.captaincy ?? null,
    curGP: p.curSeasonGP ?? 0, lastGP: p.lastSeasonGP ?? 0, metrics: metricsFor(p),
  }));

  const groups: Record<"F" | "D", Row[]> = { F: [], D: [] };
  for (const r of rows) groups[isDef(r.position) ? "D" : "F"].push(r);

  const metricKeys = [...new Set(Object.values(EDGE_COMPOSITES).flat().map((m) => m.key))];

  // Sample-size regression: pull each rate metric toward the position mean by
  // reliability = mins/(mins+K), so a 70-minute rookie can't post SC 99.
  const means: Record<"F" | "D", Record<string, number>> = { F: {}, D: {} };
  for (const g of ["F", "D"] as const) {
    for (const k of metricKeys) {
      const vals = groups[g].map((r) => r.metrics[k]).filter((v): v is number => v != null && !(k === "fo" && v === 0));
      means[g][k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
  }
  const reg = (r: Row, g: "F" | "D", k: string): number | null => {
    const raw = r.metrics[k];
    if (raw == null) return null;
    if (!REGRESS_KEYS.has(k)) return raw;
    const rel = r.mins / (r.mins + REGRESS_K);
    return raw * rel + means[g][k] * (1 - rel);
  };

  // populations of REGRESSED values. Two references:
  //  - pops[g][k]: position-split — the *analytics* percentile ("99th among D") and
  //    the pool for position-specific parameters (DF, FO).
  //  - popsAll[k]: F+D combined — the absolute-ability pool for scoring/skill params,
  //    so an elite-among-D scorer isn't inflated to a forward-elite SC. Regression
  //    still uses the position mean (a D's small sample regresses toward D, not the
  //    league), only the ranking population differs.
  const pops: Record<"F" | "D", Record<string, number[]>> = { F: {}, D: {} };
  const popsAll: Record<string, number[]> = {};
  for (const k of metricKeys) popsAll[k] = [];
  for (const g of ["F", "D"] as const) {
    for (const k of metricKeys) {
      pops[g][k] = groups[g].map((r) => reg(r, g, k)).filter((v): v is number => v != null && !(k === "fo" && v === 0)).sort((a, b) => a - b);
      if (k !== "fo") popsAll[k].push(...pops[g][k]);
    }
  }
  for (const k of metricKeys) popsAll[k].sort((a, b) => a - b);
  // Parameters judged within position (role-specific), everything else on the
  // common F+D scale. FO is centres-only; DF means different things for F vs D.
  const POS_SPECIFIC = new Set(["DF", "FO"]);
  // SC gets a partial position-adjustment: a D shoots from worse ice (point shots),
  // so pure goals/shots under-rate his shooting ability. Without shot-quality data we
  // proxy it by blending in his within-position percentile, lifting an elite-among-D
  // scorer onto ~82-90 while leaving forwards (whose position ≈ the absolute pool)
  // essentially unchanged. β applied to D only.
  const SC_POS_BLEND = 0.55;
  const onIceKeys = ["SC", "PA", "CK", "DF", "EN", "FO", "DI", "ST", "PH", "FG", "PS", "SK"];

  const out: EdgeRow[] = rows.map((r) => {
    const grp = isDef(r.position) ? "D" : "F";
    const ratings: Record<string, number> = {};
    const posPct: Record<string, number> = {}; // analytics: percentile within own position
    for (const [param, metrics] of Object.entries(EDGE_COMPOSITES)) {
      if (param === "FO" && grp === "D") continue;
      const usePos = POS_SPECIFIC.has(param);
      const scBlend = param === "SC" && grp === "D" ? SC_POS_BLEND : 0;
      let wsum = 0, wtot = 0, wposSum = 0;
      for (const m of metrics) {
        const v = reg(r, grp, m.key);
        if (v == null) continue;
        if (m.key === "fo" && v === 0) continue;
        let pct = percentileOf(v, usePos ? pops[grp][m.key] : popsAll[m.key]);
        let pp = percentileOf(v, pops[grp][m.key]); // always position-relative for the analytics number
        if (m.invert) { pct = 1 - pct; pp = 1 - pp; }
        // lift D scoring toward its position percentile (shot-quality proxy)
        const eff = scBlend ? pct * (1 - scBlend) + pp * scBlend : pct;
        wsum += eff * m.weight; wposSum += pp * m.weight; wtot += m.weight;
      }
      if (wtot > 0) { ratings[param] = ratingFromCurve(wsum / wtot, param); posPct[param] = Math.round((wposSum / wtot) * 100); }
    }
    // EX comes from the composite loop above (career GP); fall back to the age curve
    // only for a player with no imported careerGP at all.
    if (ratings.EX == null) ratings.EX = experienceFromAge(r.age);
    ratings.DU = durabilityFromAvailability(r.curGP, CUR_SEASON_GAMES, r.lastGP);
    ratings.LD = leadershipFrom(r.captaincy, ratings.EX);
    ratings.MO = EDGE_MO_DEFAULT;
    const onIce = onIceKeys.map((k) => ratings[k]).filter((x) => x != null);
    if (onIce.length) ratings.OV = Math.round(onIce.reduce((a, b) => a + b, 0) / onIce.length);
    return { playerId: r.id, name: r.name, position: r.position, posGroup: grp, league: r.league, teamCode: r.teamCode, ratings, posPct };
  });

  if (calibrate) calibrateSkaters(out, await sthsSkaterRef({ rosterType: league, isGoalie: false }));
  return out;
}

// ---- AHL skaters (scoring only; TOI/hits/blocks aren't in the AHL feed) ----

// AHL → NHL-equivalent translation so an AHL scoring title doesn't become SC 99:
// scoring translates ~0.45×; penalties are ~league-neutral.
const AHL_NHLE: Record<string, number> = { g: 0.45, a: 0.45, sh: 0.45, pim: 1.0 };
const AHL_NHL_SEL = { id: true, position: true, curSeasonGP: true, curSeasonG: true, curSeasonA: true, curSeasonShots: true, curSeasonPim: true, lastSeasonGP: true, lastSeasonG: true, lastSeasonA: true, lastSeasonShots: true, lastSeasonPim: true } as const;
const AHL_SEL = { id: true, name: true, position: true, teamId: true, weight: true, age: true, captaincy: true, ahlStats: true } as const;

/** AHL skater Edge ratings — scoring params (SC/PA/DI) built from per-GAME AHL rates
 *  translated to NHL-equivalent, plus ST/EX/DU/LD/MO from age/size. Any player who
 *  logged AHL games is eligible (even now-NHL-roster call-ups like Kaliyev), read
 *  from the dedicated `ahlStats` blob so his NHL cur/last stay untouched.
 *  SC/PA percentile against a COMBINED NHL skater pool (absolute scoring — forwards
 *  outrank puck-moving D), while regression pulls small samples toward the AHL mean
 *  for the player's own position group. CK/DF/EN/FO/PH need data the AHL feed lacks. */
export async function edgeAhlSkaterRatings(calibrate = true): Promise<EdgeRow[]> {
  const [nhl, players, teams] = await Promise.all([
    prisma.player.findMany({ where: { rosterType: "NHL", isGoalie: false }, select: AHL_NHL_SEL }),
    prisma.player.findMany({ where: { isGoalie: false, ahlStats: { not: Prisma.DbNull } }, select: AHL_SEL }),
    prisma.team.findMany({ select: { id: true, code: true } }),
  ]);
  const codeById = new Map(teams.map((t) => [t.id, t.code]));
  const grp = (pos = "") => (isDef(pos) ? "D" : "F");
  // NHL per-GAME rate over both seasons combined (reference distribution)
  const nhlPerGp = (p: any, cur: string, last: string) => {
    const gp = (p.curSeasonGP ?? 0) + (p.lastSeasonGP ?? 0);
    return gp > 0 ? ((p[cur] ?? 0) + (p[last] ?? 0)) / gp : null;
  };
  const nhlMetrics = (p: any) => ({
    g: nhlPerGp(p, "curSeasonG", "lastSeasonG"), a: nhlPerGp(p, "curSeasonA", "lastSeasonA"),
    sh: nhlPerGp(p, "curSeasonShots", "lastSeasonShots"), pim: nhlPerGp(p, "curSeasonPim", "lastSeasonPim"),
  });
  // AHL per-GAME rate from the ahlStats blob (cur + last combined)
  const ahlOf = (p: any) => {
    const s = (p.ahlStats as any) ?? {}; const c = s.cur ?? {}; const l = s.last ?? {};
    const gp = (c.gp ?? 0) + (l.gp ?? 0);
    const rate = (ck: string) => gp > 0 ? ((c[ck] ?? 0) + (l[ck] ?? 0)) / gp : null;
    return { gp, g: rate("g"), a: rate("a"), sh: rate("sh"), pim: rate("pim") };
  };

  // COMBINED NHL reference pool (per-GAME) per metric — scoring is judged absolutely,
  // so an AHL forward's translated rate is ranked against every NHL skater, not just
  // his position (a modest-scoring D then lands low, as he should for SC).
  const poolAll: Record<string, number[]> = { g: [], a: [], sh: [], pim: [] };
  for (const p of nhl) { const m = nhlMetrics(p); for (const k of ["g", "a", "sh", "pim"]) { const v = (m as any)[k]; if (v != null) poolAll[k].push(v); } }
  for (const k of ["g", "a", "sh", "pim"]) poolAll[k].sort((a, b) => a - b);

  // AHL population means per group/metric (per-GAME) — regression target, so a
  // 1-game hot streak can't spike SC. Position-specific so a D regresses toward D.
  const ahlMean: Record<"F" | "D", Record<string, number>> = { F: {}, D: {} };
  for (const g of ["F", "D"] as const) for (const k of ["g", "a", "sh", "pim"]) {
    const vals = players.filter((p) => grp(p.position ?? "") === g).map((p) => (ahlOf(p) as any)[k]).filter((v: number | null) => v != null) as number[];
    ahlMean[g][k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }
  const AHL_REG_K = 25; // games at which reliability = 0.5
  // Smaller D lift than the NHL path (0.55): AHL forward SC tops out ~78 after the
  // ×0.45 translation, so a full lift would push elite D to parity with forwards.
  const SC_POS_BLEND = 0.3;

  // regressed, NHL-translated per-game value for a player+metric
  const transRate = (p: any, k: string): number | null => {
    const m = ahlOf(p); const raw = (m as any)[k]; if (raw == null) return null;
    const g = grp(p.position ?? ""); const rel = m.gp > 0 ? m.gp / (m.gp + AHL_REG_K) : 0;
    return (ahlMean[g][k] + rel * (raw - ahlMean[g][k])) * (AHL_NHLE[k] ?? 1);
  };
  // AHL position pools of translated values — for the within-position analytics
  // percentile and the D scoring lift (parallel to the NHL path).
  const ahlPos: Record<"F" | "D", Record<string, number[]>> = { F: {}, D: {} };
  for (const g of ["F", "D"] as const) for (const k of ["g", "a", "sh", "pim"]) {
    ahlPos[g][k] = players.filter((p) => grp(p.position ?? "") === g).map((p) => transRate(p, k)).filter((v): v is number => v != null).sort((a, b) => a - b);
  }

  // weight pool (AHL vs AHL) for ST
  const wPool: Record<"F" | "D", number[]> = { F: [], D: [] };
  for (const p of players) if (p.weight) wPool[grp(p.position ?? "")].push(p.weight);
  for (const g of ["F", "D"] as const) wPool[g].sort((a, b) => a - b);

  const out: EdgeRow[] = players.map((p) => {
    const g = grp(p.position ?? "");
    const m = ahlOf(p);
    const posPct: Record<string, number> = {};
    // combined-NHL percentile (absolute) and within-AHL-position percentile (analytics)
    const pct = (k: string) => { const v = transRate(p, k); return v == null ? null : percentileOf(v, poolAll[k]); };
    const ppos = (k: string) => { const v = transRate(p, k); return v == null ? null : percentileOf(v, ahlPos[g][k]); };
    const ratings: Record<string, number> = {};
    const gp = pct("g"), sp = pct("sh"), ap = pct("a"), pp = pct("pim");
    const gpP = ppos("g"), spP = ppos("sh"), apP = ppos("a");
    if (gp != null) {
      const scAbs = gp * 0.7 + (sp ?? gp) * 0.3;
      const scPos = (gpP ?? gp) * 0.7 + (spP ?? sp ?? gpP ?? gp) * 0.3;
      ratings.SC = ratingFromCurve(g === "D" ? scAbs * (1 - SC_POS_BLEND) + scPos * SC_POS_BLEND : scAbs, "SC");
      posPct.SC = Math.round(scPos * 100);
    }
    if (ap != null) { ratings.PA = ratingFromCurve(ap, "PA"); if (apP != null) posPct.PA = Math.round(apP * 100); }
    if (pp != null) ratings.DI = ratingFromCurve(1 - pp, "DI");
    if (p.weight != null && wPool[g].length) ratings.ST = ratingFromCurve(percentileOf(p.weight, wPool[g]), "DEFAULT");
    const ex = experienceFromAge(p.age); ratings.EX = ex;
    const s = (p.ahlStats as any) ?? {};
    ratings.DU = durabilityFromAvailability(s.cur?.gp ?? 0, CUR_SEASON_GAMES, s.last?.gp ?? 0);
    ratings.LD = leadershipFrom(p.captaincy, ex); ratings.MO = EDGE_MO_DEFAULT;
    const core = ["SC", "PA", "DI", "ST"].map((k) => ratings[k]).filter((v) => v != null);
    if (core.length) ratings.OV = Math.round(core.reduce((a, b) => a + b, 0) / core.length);
    return { playerId: p.id, name: cleanName(p.name), position: p.position ?? "", posGroup: g, league: "AHL", teamCode: p.teamId != null ? codeById.get(p.teamId) ?? null : null, ratings, posPct };
  });

  if (calibrate) calibrateSkaters(out, await sthsSkaterRef({ rosterType: "AHL", isGoalie: false }));
  return out;
}

// ---- Goalies ----

type GM = { gp: number; shots: number; icetime: number; gsax: number; svPct: number; hdSv: number; mdSv: number; ldSv: number; hdGsax: number; rebCtrl: number };
const heightCm = (h: string | null) => { const m = (h ?? "").match(/(\d+)\s*cm/); return m ? Number(m[1]) : null; };
const GOALIE_REG_K = 700; // shots faced at which reliability = 0.5

/** Edge ratings for every goalie in a league (MoneyPuck-driven; NHL only for now). */
export async function edgeGoalieRatings(league = "NHL", calibrate = true): Promise<EdgeRow[]> {
  const goalies = await prisma.player.findMany({
    where: { rosterType: league, isGoalie: true },
    select: { id: true, name: true, position: true, teamId: true, height: true, age: true, captaincy: true, goalieAdvanced: true, lastSeasonGP: true, curSeasonGP: true, careerGP: true },
  });
  const teams = await prisma.team.findMany({ select: { id: true, code: true } });
  const codeById = new Map(teams.map((t) => [t.id, t.code]));

  type GR = { id: number; name: string; position: string; teamCode: string | null; age: number | null; captaincy: string | null; curGP: number; lastGP: number; shots: number; metrics: Record<string, number | null> };
  const rows: GR[] = [];
  for (const g of goalies) {
    const adv = g.goalieAdvanced as { cur: GM | null; last: GM | null } | null;
    if (!adv || (!adv.cur && !adv.last)) continue;
    const c = adv.cur, l = adv.last;
    const per60g = (m: GM | null) => (m && m.icetime > 0 ? (m.gsax / (m.icetime / 3600)) : null);
    const bl = (sel: (m: GM) => number) => blend(c ? sel(c) : null, l ? sel(l) : null);
    rows.push({
      id: g.id, name: cleanName(g.name), position: "G",
      teamCode: g.teamId != null ? codeById.get(g.teamId) ?? null : null,
      age: g.age ?? null, captaincy: g.captaincy ?? null,
      curGP: g.curSeasonGP ?? c?.gp ?? 0, lastGP: g.lastSeasonGP ?? l?.gp ?? 0,
      shots: (c?.shots ?? 0) + (l?.shots ?? 0),
      metrics: {
        ldSv: bl((m) => m.ldSv), mdSv: bl((m) => m.mdSv), hdSv: bl((m) => m.hdSv),
        gsax60: blend(per60g(c), per60g(l)), hdGsax: bl((m) => m.hdGsax), rebCtrl: bl((m) => m.rebCtrl),
        icetime: bl((m) => m.icetime), sz: heightCm(g.height),
        regGP: (g.careerGP as any)?.reg ?? null, poGP: (g.careerGP as any)?.po ?? null,
      },
    });
  }

  const metricKeys = [...new Set(Object.values(EDGE_GOALIE_COMPOSITES).flat().map((m) => m.key))];
  const perfKeys = new Set(["ldSv", "mdSv", "hdSv", "gsax60", "hdGsax", "rebCtrl"]); // sample-regressed
  const means: Record<string, number> = {};
  for (const k of metricKeys) {
    const vals = rows.map((r) => r.metrics[k]).filter((v): v is number => v != null);
    means[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }
  const reg = (r: GR, k: string): number | null => {
    const raw = r.metrics[k];
    if (raw == null) return null;
    if (!perfKeys.has(k)) return raw;
    const rel = r.shots / (r.shots + GOALIE_REG_K);
    return raw * rel + means[k] * (1 - rel);
  };
  const pops: Record<string, number[]> = {};
  for (const k of metricKeys) pops[k] = rows.map((r) => reg(r, k)).filter((v): v is number => v != null).sort((a, b) => a - b);

  const out: EdgeRow[] = rows.map((r) => {
    const ratings: Record<string, number> = {};
    for (const [param, metrics] of Object.entries(EDGE_GOALIE_COMPOSITES)) {
      let wsum = 0, wtot = 0;
      for (const m of metrics) {
        const v = reg(r, m.key);
        if (v == null) continue;
        let pct = percentileOf(v, pops[m.key]);
        if (m.invert) pct = 1 - pct;
        wsum += pct * m.weight; wtot += m.weight;
      }
      if (wtot > 0) ratings[param] = ratingFromCurve(wsum / wtot, param);
    }
    if (ratings.EX == null) ratings.EX = experienceFromAge(r.age);
    ratings.DU = durabilityFromAvailability(r.curGP, CUR_SEASON_GAMES, r.lastGP);
    ratings.LD = leadershipFrom(r.captaincy, ratings.EX);
    ratings.MO = EDGE_MO_DEFAULT;
    const core = ["SC", "RT", "HS", "AG", "RB", "EN", "SZ"].map((k) => ratings[k]).filter((v) => v != null);
    if (core.length) ratings.OV = Math.round(core.reduce((a, b) => a + b, 0) / core.length);
    return { playerId: r.id, name: r.name, position: "G", posGroup: "F" as const, league, teamCode: r.teamCode, ratings };
  });

  if (calibrate) calibrateGoalies(out, await sthsGoalieRef({ rosterType: league, isGoalie: true }));
  return out;
}

/** Compute and PERSIST Edge ratings onto every player (Player.edgeRatings). Kept
 *  separate from the STHS ck/sc/... fields the sim reads, so this is analytics only. */
export async function persistEdgeRatings(): Promise<{ written: number }> {
  const all: EdgeRow[] = [
    ...(await edgeRatings("NHL")), ...(await edgeAhlSkaterRatings()),
    ...(await edgeGoalieRatings("NHL")),
  ];
  let written = 0;
  for (const r of all) {
    await prisma.player.update({ where: { id: r.playerId }, data: { edgeRatings: r.ratings as object } });
    written++;
  }
  return { written };
}

/** Edge ratings for a single player (or null). */
export async function edgeForPlayer(playerId: number): Promise<EdgeRow | null> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { rosterType: true, isGoalie: true } });
  if (!p || p.isGoalie) return null;
  const all = await edgeRatings(p.rosterType ?? "NHL");
  return all.find((r) => r.playerId === playerId) ?? null;
}
