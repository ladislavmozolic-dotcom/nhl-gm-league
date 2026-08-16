"use server";

// Edge Parameters engine (DB side). Builds each player's per-60 metric blend from
// real NHL/AHL stats, ranks them into percentiles within (league × position group),
// and composites those into Edge ratings. Skaters only for now.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";
import { per60, blend, percentileOf, percentileToRating, EDGE_COMPOSITES } from "./edge-params";

const isDef = (pos = "") => /(^|\/)D(\/|$)/.test(pos) || pos === "D";

type Row = {
  id: number; name: string; position: string; league: string; teamCode: string | null;
  gp: number; metrics: Record<string, number | null>;
};

export type EdgeRow = {
  playerId: number; name: string; position: string; posGroup: "F" | "D"; league: string; teamCode: string | null;
  ratings: Record<string, number>; // SC, PA, CK, DF, EN, FO, DI
};

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
    g60, a60, sh60,
    shpct: shTot > 0 ? gTot / shTot : null,
    hit60: rate(p.curSeasonHits ?? 0, p.lastSeasonHits ?? 0),
    blk60: rate(p.curSeasonBlocks ?? 0, p.lastSeasonBlocks ?? 0),
    tk60: rate(p.curSeasonTK ?? 0, p.lastSeasonTK ?? 0),
    pm60: rate(p.curSeasonPM ?? 0, p.lastSeasonPM ?? 0),
    pim60: rate(p.curSeasonPim ?? 0, p.lastSeasonPim ?? 0),
    shtoi: blend(p.curSeasonShToi, p.lastSeasonShToi),
    toi: blend(p.curSeasonToi, p.lastSeasonToi),
    // faceoffs only meaningful for players who take them (centres); wingers ~0
    fo: blend(p.curSeasonFoPct, p.lastSeasonFoPct),
  };
}

const SEL = {
  id: true, name: true, position: true, rosterType: true, teamId: true,
  curSeasonGP: true, curSeasonToi: true, curSeasonG: true, curSeasonA: true, curSeasonShots: true,
  curSeasonHits: true, curSeasonBlocks: true, curSeasonTK: true, curSeasonPM: true, curSeasonPim: true,
  curSeasonShToi: true, curSeasonFoPct: true,
  lastSeasonGP: true, lastSeasonToi: true, lastSeasonG: true, lastSeasonA: true, lastSeasonShots: true,
  lastSeasonHits: true, lastSeasonBlocks: true, lastSeasonTK: true, lastSeasonPM: true, lastSeasonPim: true,
  lastSeasonShToi: true, lastSeasonFoPct: true,
} as const;

/** Compute Edge ratings for every skater in a league (default NHL). */
export async function edgeRatings(league = "NHL"): Promise<EdgeRow[]> {
  const players = await prisma.player.findMany({ where: { rosterType: league, isGoalie: false }, select: SEL });
  const teams = await prisma.team.findMany({ select: { id: true, code: true } });
  const codeById = new Map(teams.map((t) => [t.id, t.code]));

  const rows: Row[] = players.map((p) => ({
    id: p.id, name: cleanName(p.name), position: p.position ?? "", league,
    teamCode: p.teamId != null ? codeById.get(p.teamId) ?? null : null,
    gp: (p.curSeasonGP ?? 0) + (p.lastSeasonGP ?? 0), metrics: metricsFor(p),
  }));

  // build sorted-ascending populations per position group, per metric
  const groups: Record<"F" | "D", Row[]> = { F: [], D: [] };
  for (const r of rows) groups[isDef(r.position) ? "D" : "F"].push(r);

  const pops: Record<"F" | "D", Record<string, number[]>> = { F: {}, D: {} };
  const metricKeys = [...new Set(Object.values(EDGE_COMPOSITES).flat().map((m) => m.key))];
  for (const g of ["F", "D"] as const) {
    for (const k of metricKeys) {
      pops[g][k] = groups[g].map((r) => r.metrics[k]).filter((v): v is number => v != null && !(k === "fo" && v === 0)).sort((a, b) => a - b);
    }
  }

  const out: EdgeRow[] = rows.map((r) => {
    const grp = isDef(r.position) ? "D" : "F";
    const ratings: Record<string, number> = {};
    for (const [param, metrics] of Object.entries(EDGE_COMPOSITES)) {
      if (param === "FO" && grp === "D") continue; // D don't take faceoffs
      let wsum = 0, wtot = 0;
      for (const m of metrics) {
        const v = r.metrics[m.key];
        if (v == null) continue;
        if (m.key === "fo" && v === 0) continue; // no faceoffs taken → not rated on FO
        let pct = percentileOf(v, pops[grp][m.key]);
        if (m.invert) pct = 1 - pct;
        wsum += pct * m.weight; wtot += m.weight;
      }
      if (wtot > 0) ratings[param] = percentileToRating(wsum / wtot);
    }
    return { playerId: r.id, name: r.name, position: r.position, posGroup: grp, league: r.league, teamCode: r.teamCode, ratings };
  });

  return out;
}

/** Edge ratings for a single player (or null). */
export async function edgeForPlayer(playerId: number): Promise<EdgeRow | null> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { rosterType: true, isGoalie: true } });
  if (!p || p.isGoalie) return null;
  const all = await edgeRatings(p.rosterType ?? "NHL");
  return all.find((r) => r.playerId === playerId) ?? null;
}
