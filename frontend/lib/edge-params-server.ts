"use server";

// Edge Parameters engine (DB side). Builds each player's per-60 metric blend from
// real NHL/AHL stats, ranks them into percentiles within (league × position group),
// and composites those into Edge ratings. Skaters only for now.

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
  ratings: Record<string, number>; // SC PA CK DF EN FO DI ST PH EX DU LD MO OV
};

// per-60 rate metrics get regressed toward the position mean by sample reliability;
// direct measurements (ice time, weight, SH-TOI) do not.
const REGRESS_KEYS = new Set(["g60", "a60", "sh60", "off60", "hit60", "blk60", "tk60", "gv60", "pm60", "pim60", "fo", "shpct"]);
const REGRESS_K = 500; // minutes at which reliability = 0.5

/** Per-60 metric blend (80% current / 20% prior real season) for one player. */
function metricsFor(p: any): Record<string, number | null> {
  const cGP = p.curSeasonGP ?? 0, lGP = p.lastSeasonGP ?? 0;
  const cTOI = p.curSeasonToi ?? 0, lTOI = p.lastSeasonToi ?? 0;
  const rate = (cv: number, lv: number) => blend(per60(cv, cTOI, cGP), per60(lv, lTOI, lGP));
  const g60 = rate(p.curSeasonG ?? 0, p.lastSeasonG ?? 0);
  const a60 = rate(p.curSeasonA ?? 0, p.lastSeasonA ?? 0);
  const sh60 = rate(p.curSeasonShots ?? 0, p.lastSeasonShots ?? 0);
  const gTot = blend(p.curSeasonG, p.lastSeasonG), shTot = blend(p.curSeasonShots, p.lastSeasonShots);
  return {
    g60, a60, sh60, off60: g60 + a60,
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
  };
}

const SEL = {
  id: true, name: true, position: true, rosterType: true, teamId: true, weight: true, age: true, captaincy: true,
  curSeasonGP: true, curSeasonToi: true, curSeasonG: true, curSeasonA: true, curSeasonShots: true, curSeasonGV: true,
  curSeasonHits: true, curSeasonBlocks: true, curSeasonTK: true, curSeasonPM: true, curSeasonPim: true,
  curSeasonShToi: true, curSeasonFoPct: true,
  lastSeasonGP: true, lastSeasonToi: true, lastSeasonG: true, lastSeasonA: true, lastSeasonShots: true,
  lastSeasonHits: true, lastSeasonBlocks: true, lastSeasonTK: true, lastSeasonGV: true, lastSeasonPM: true, lastSeasonPim: true,
  lastSeasonShToi: true, lastSeasonFoPct: true,
} as const;

/** Compute Edge ratings for every skater in a league (default NHL). */
export async function edgeRatings(league = "NHL"): Promise<EdgeRow[]> {
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

  // populations of REGRESSED values, per position group per metric
  const pops: Record<"F" | "D", Record<string, number[]>> = { F: {}, D: {} };
  for (const g of ["F", "D"] as const) {
    for (const k of metricKeys) {
      pops[g][k] = groups[g].map((r) => reg(r, g, k)).filter((v): v is number => v != null && !(k === "fo" && v === 0)).sort((a, b) => a - b);
    }
  }

  const out: EdgeRow[] = rows.map((r) => {
    const grp = isDef(r.position) ? "D" : "F";
    const ratings: Record<string, number> = {};
    for (const [param, metrics] of Object.entries(EDGE_COMPOSITES)) {
      if (param === "FO" && grp === "D") continue;
      let wsum = 0, wtot = 0;
      for (const m of metrics) {
        const v = reg(r, grp, m.key);
        if (v == null) continue;
        if (m.key === "fo" && v === 0) continue;
        let pct = percentileOf(v, pops[grp][m.key]);
        if (m.invert) pct = 1 - pct;
        wsum += pct * m.weight; wtot += m.weight;
      }
      if (wtot > 0) ratings[param] = ratingFromCurve(wsum / wtot, param);
    }
    // direct / special parameters (not percentile composites)
    const ex = experienceFromAge(r.age);
    ratings.EX = ex;
    ratings.DU = durabilityFromAvailability(r.curGP, CUR_SEASON_GAMES, r.lastGP);
    ratings.LD = leadershipFrom(r.captaincy, ex);
    ratings.MO = EDGE_MO_DEFAULT;
    // OV — informative average of the computed on-ice ratings (never enters the sim)
    const onIce = ["SC", "PA", "CK", "DF", "EN", "FO", "DI", "ST", "PH"].map((k) => ratings[k]).filter((v) => v != null);
    if (onIce.length) ratings.OV = Math.round(onIce.reduce((a, b) => a + b, 0) / onIce.length);
    return { playerId: r.id, name: r.name, position: r.position, posGroup: grp, league: r.league, teamCode: r.teamCode, ratings };
  });

  return out;
}

// ---- AHL skaters (scoring only; TOI/hits/blocks aren't in the AHL feed) ----

// AHL → NHL-equivalent translation so an AHL scoring title doesn't become SC 99:
// scoring translates ~0.45×; penalties are ~league-neutral.
const AHL_NHLE: Record<string, number> = { g: 0.45, a: 0.45, sh: 0.45, pim: 1.0 };
const AHL_G_SEL = { id: true, name: true, position: true, teamId: true, weight: true, age: true, captaincy: true, curSeasonGP: true, curSeasonG: true, curSeasonA: true, curSeasonShots: true, curSeasonPim: true, lastSeasonGP: true, lastSeasonG: true, lastSeasonA: true, lastSeasonShots: true, lastSeasonPim: true } as const;

/** AHL skater Edge ratings — scoring params (SC/PA/DI) built from per-GAME rates
 *  translated to NHL-equivalent and percentiled against the NHL distribution, plus
 *  ST/EX/DU/LD/MO from age/size. CK/DF/EN/FO/PH need data the AHL feed lacks. */
export async function edgeAhlSkaterRatings(): Promise<EdgeRow[]> {
  const [nhl, ahl, teams] = await Promise.all([
    prisma.player.findMany({ where: { rosterType: "NHL", isGoalie: false }, select: AHL_G_SEL }),
    prisma.player.findMany({ where: { rosterType: "AHL", isGoalie: false }, select: AHL_G_SEL }),
    prisma.team.findMany({ select: { id: true, code: true } }),
  ]);
  const codeById = new Map(teams.map((t) => [t.id, t.code]));
  const grp = (pos = "") => (isDef(pos) ? "D" : "F");
  // per-GAME rate over both seasons combined
  const perGp = (p: any, cur: string, last: string) => {
    const gp = (p.curSeasonGP ?? 0) + (p.lastSeasonGP ?? 0);
    return gp > 0 ? ((p[cur] ?? 0) + (p[last] ?? 0)) / gp : null;
  };
  const metricsOf = (p: any, nhle = false) => {
    const f = (k: string) => nhle ? (AHL_NHLE[k] ?? 1) : 1;
    return {
      g: perGp(p, "curSeasonG", "lastSeasonG") as number | null,
      a: perGp(p, "curSeasonA", "lastSeasonA") as number | null,
      sh: perGp(p, "curSeasonShots", "lastSeasonShots") as number | null,
      pim: perGp(p, "curSeasonPim", "lastSeasonPim") as number | null,
      _f: f,
    };
  };
  // NHL reference pools (per-GAME) per position group, per metric
  const pools: Record<"F" | "D", Record<string, number[]>> = { F: {}, D: {} };
  for (const g of ["F", "D"] as const) for (const k of ["g", "a", "sh", "pim"]) pools[g][k] = [];
  for (const p of nhl) {
    const g = grp(p.position ?? ""); const m = metricsOf(p);
    for (const k of ["g", "a", "sh", "pim"]) { const v = (m as any)[k]; if (v != null) pools[g][k].push(v); }
  }
  for (const g of ["F", "D"] as const) for (const k of ["g", "a", "sh", "pim"]) pools[g][k].sort((a, b) => a - b);

  // weight pool (AHL vs AHL) for ST
  const wPool: Record<"F" | "D", number[]> = { F: [], D: [] };
  for (const p of ahl) if (p.weight) wPool[grp(p.position ?? "")].push(p.weight);
  for (const g of ["F", "D"] as const) wPool[g].sort((a, b) => a - b);

  return ahl.map((p) => {
    const g = grp(p.position ?? "");
    const m = metricsOf(p, true); // NHL-equivalent
    const pct = (k: string) => { const v = (m as any)[k] * m._f(k); return m[k as "g"] != null ? percentileOf(v, pools[g][k]) : null; };
    const ratings: Record<string, number> = {};
    const gp = pct("g"), sp = pct("sh"), ap = pct("a"), pp = pct("pim");
    if (gp != null) ratings.SC = ratingFromCurve((gp * 0.7 + (sp ?? gp) * 0.3), "SC");
    if (ap != null) ratings.PA = ratingFromCurve(ap, "PA");
    if (pp != null) ratings.DI = ratingFromCurve(1 - pp, "DI");
    if (p.weight != null && wPool[g].length) ratings.ST = ratingFromCurve(percentileOf(p.weight, wPool[g]), "DEFAULT");
    const ex = experienceFromAge(p.age); ratings.EX = ex;
    ratings.DU = durabilityFromAvailability(p.curSeasonGP ?? 0, CUR_SEASON_GAMES, p.lastSeasonGP ?? 0);
    ratings.LD = leadershipFrom(p.captaincy, ex); ratings.MO = EDGE_MO_DEFAULT;
    const core = ["SC", "PA", "DI", "ST"].map((k) => ratings[k]).filter((v) => v != null);
    if (core.length) ratings.OV = Math.round(core.reduce((a, b) => a + b, 0) / core.length);
    return { playerId: p.id, name: cleanName(p.name), position: p.position ?? "", posGroup: g, league: "AHL", teamCode: p.teamId != null ? codeById.get(p.teamId) ?? null : null, ratings };
  });
}

// ---- Goalies ----

type GM = { gp: number; shots: number; icetime: number; gsax: number; svPct: number; hdSv: number; mdSv: number; ldSv: number; hdGsax: number; rebCtrl: number };
const heightCm = (h: string | null) => { const m = (h ?? "").match(/(\d+)\s*cm/); return m ? Number(m[1]) : null; };
const GOALIE_REG_K = 700; // shots faced at which reliability = 0.5

/** Edge ratings for every goalie in a league (MoneyPuck-driven; NHL only for now). */
export async function edgeGoalieRatings(league = "NHL"): Promise<EdgeRow[]> {
  const goalies = await prisma.player.findMany({
    where: { rosterType: league, isGoalie: true },
    select: { id: true, name: true, position: true, teamId: true, height: true, age: true, captaincy: true, goalieAdvanced: true, lastSeasonGP: true, curSeasonGP: true },
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

  return rows.map((r) => {
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
    const ex = experienceFromAge(r.age);
    ratings.EX = ex;
    ratings.DU = durabilityFromAvailability(r.curGP, CUR_SEASON_GAMES, r.lastGP);
    ratings.LD = leadershipFrom(r.captaincy, ex);
    ratings.MO = EDGE_MO_DEFAULT;
    const core = ["SC", "RT", "HS", "AG", "RB", "EN", "SZ"].map((k) => ratings[k]).filter((v) => v != null);
    if (core.length) ratings.OV = Math.round(core.reduce((a, b) => a + b, 0) / core.length);
    return { playerId: r.id, name: r.name, position: "G", posGroup: "F" as const, league, teamCode: r.teamCode, ratings };
  });
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
