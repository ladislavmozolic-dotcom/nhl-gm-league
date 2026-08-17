// NHL EDGE player-tracking (skating speed) — the real signal the SK param was
// missing. api-web.nhle.com/v1/edge/skater-detail/{nhlId}/{season}/2 returns
// per-player skatingSpeed.speedMax / burstsOver20 / totalDistanceSkated, each with
// a league percentile (0-1) already computed by the NHL. We store those percentiles
// and blend 80% cur (2025-26) / 20% last (2024-25), matching the rest of Edge.

import { prisma } from "./prisma";

const BASE = "https://api-web.nhle.com/v1/edge/skater-detail";
const UA = "Mozilla/5.0 (compatible; ProfiNHL-League/1.0)";
export const EDGE_SEASON_CUR = 20252026;
export const EDGE_SEASON_LAST = 20242025;

type SpeedRow = { spd: number | null; brst: number | null; dist: number | null };

async function fetchOne(nhlId: number, season: number): Promise<SpeedRow | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${BASE}/${nhlId}/${season}/2`, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) return null;
    const d: any = await res.json();
    const s = d?.skatingSpeed;
    const spd = s?.speedMax?.percentile ?? null;
    const brst = s?.burstsOver20?.percentile ?? null;
    const dist = d?.totalDistanceSkated?.percentile ?? null;
    if (spd == null && brst == null && dist == null) return null;
    return { spd, brst, dist };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Pull EDGE skating percentiles for every NHL skater with an nhlId, both seasons. */
export async function importNhlEdgeSpeed(): Promise<{ total: number; matched: number }> {
  const players = await prisma.player.findMany({ where: { isGoalie: false, nhlId: { not: null } }, select: { id: true, nhlId: true } });
  let matched = 0;
  // modest sequential pace to stay friendly to the public API
  for (const p of players) {
    const [cur, last] = await Promise.all([fetchOne(p.nhlId!, EDGE_SEASON_CUR), fetchOne(p.nhlId!, EDGE_SEASON_LAST)]);
    if (!cur && !last) continue;
    await prisma.player.update({ where: { id: p.id }, data: { edgeSpeed: { cur: cur ?? undefined, last: last ?? undefined } } });
    matched++;
  }
  return { total: players.length, matched };
}
