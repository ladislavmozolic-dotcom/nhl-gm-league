// Server-side glue for the Free Agent Frenzy engine: builds the "market" from
// every signed contract, then values free agents / re-sign candidates against it.

import { prisma } from "./prisma";
import { getLeagueClock } from "./calendar-server";
import {
  faPosGroup, skaterMarket, goalieMarket, anchorFromPool, buildDemand,
  slotForRank, slotToLine, desiredDeployment, deploymentDemand, offerUtility, offerAcceptable,
  type MarketRow, type Demand, type FaPos, type Contention, type Deployment, type Desired, type LineSlot,
} from "./free-agency";

/** Current weekly negotiation round (1..3); 1 = opening ask outside the window. */
export async function currentFrenzyRound(): Promise<number> {
  return (await getLeagueClock()).frenzyRound || 1;
}

export type LeagueCap = { mode: string; upper: number; lower: number; faOpen: boolean };

export async function loadLeagueCap(): Promise<LeagueCap> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const real = cfg?.rosterMode === "real";
  return {
    mode: cfg?.rosterMode ?? "profinhl",
    upper: real ? (cfg?.realCapUpper ?? 104_000_000) : (cfg?.profinhlCapUpper ?? 85_900_000),
    lower: real ? (cfg?.realCapLower ?? 76_500_000) : (cfg?.profinhlCapLower ?? 51_500_000),
    faOpen: !!cfg?.faOpen,
  };
}

const SEL = {
  id: true, isGoalie: true, position: true, age: true, capHit: true, rosterType: true,
  sc: true, pa: true, df: true, sk: true, lastSeasonGP: true, lastSeasonPts: true, morale: true,
  goalieRating: { select: { ag: true, rb: true, sc: true, hs: true } },
} as const;

/** The "full slate" games played this season (p85 of everyone with a value) — a
 *  player who played well under this missed real time (injury/down year). */
export async function leagueFullGP(): Promise<number> {
  const rows = await prisma.player.findMany({ where: { lastSeasonGP: { gt: 0 } }, select: { lastSeasonGP: true } });
  const gps = rows.map((r) => r.lastSeasonGP!).sort((a, b) => a - b);
  if (gps.length === 0) return 0;
  return gps[Math.floor(gps.length * 0.85)] || gps[gps.length - 1];
}

/** Coming off a down season if he's played under 60% of the full slate. */
export function isDownSeason(lastSeasonGP: number | null | undefined, fullGP: number): boolean {
  return fullGP > 0 && lastSeasonGP != null && lastSeasonGP > 0 && lastSeasonGP < 0.6 * fullGP;
}

type PoolPlayer = {
  isGoalie: boolean; position: string | null; capHit: number | null;
  sc: number | null; pa: number | null; df: number | null; sk: number | null;
  lastSeasonGP?: number | null; lastSeasonPts?: number | null; morale?: number | null;
  goalieRating: { ag: number | null; rb: number | null; sc: number | null; hs: number | null } | null;
};

/** Sim-weighted market rating for any player row (skater attrs or goalie card). */
export function playerMarket(p: PoolPlayer): { grp: FaPos; market: number } {
  const grp = faPosGroup(p.position, p.isGoalie);
  if (grp === "G") return { grp, market: goalieMarket(p.goalieRating ?? {}) };
  return { grp, market: skaterMarket(p, grp) };
}

/** Every signed contract becomes one comparable row. */
export async function loadMarketPool(): Promise<MarketRow[]> {
  const signed = await prisma.player.findMany({
    where: { rosterType: { in: ["NHL", "AHL"] }, capHit: { gt: 0 } },
    select: SEL,
  });
  return signed.map((p) => {
    const { grp, market } = playerMarket(p as PoolPlayer);
    return { grp, market, capHit: p.capHit ?? 0 };
  });
}

export type DemandFor = { demand: Demand; grp: FaPos };

/** Compute the contract demand for one player id (used by signing / extension). */
export async function demandForPlayerId(playerId: number, pool?: MarketRow[]): Promise<DemandFor | null> {
  const p = await prisma.player.findUnique({
    where: { id: playerId },
    select: { ...SEL, faDemandOverride: true },
  });
  if (!p) return null;
  const marketPool = pool ?? (await loadMarketPool());
  const fullGP = await leagueFullGP();
  const round = await currentFrenzyRound();
  return demandFromRow(p as PoolPlayer & { age: number | null; faDemandOverride: number | null }, marketPool, fullGP, round);
}

function demandFromRow(
  p: PoolPlayer & { age: number | null; faDemandOverride: number | null },
  pool: MarketRow[], fullGP: number, round: number,
): DemandFor {
  const { grp, market } = playerMarket(p);
  const { anchor, count } = anchorFromPool(pool, grp, market);
  const demand = buildDemand({
    market, grp, age: p.age, anchor, comps: count,
    override: p.faDemandOverride, capGrowth: 1, round,
    downSeason: isDownSeason(p.lastSeasonGP, fullGP), morale: p.morale,
  });
  return { demand, grp };
}

// --- Team context: contention tier + where a free agent slots on a given club ---

/** Contender / middle / rebuild for every NHL team, from roster strength
 *  (mean OV of its top-18 skaters), split into thirds. */
export async function teamContentionMap(): Promise<Map<number, Contention>> {
  const players = await prisma.player.findMany({
    where: { rosterType: "NHL", isGoalie: false }, select: { teamId: true, overall: true },
  });
  const byTeam = new Map<number, number[]>();
  for (const p of players) {
    if (p.overall == null) continue;
    const a = byTeam.get(p.teamId) ?? [];
    a.push(p.overall); byTeam.set(p.teamId, a);
  }
  const strength = [...byTeam.entries()].map(([id, ovs]) => {
    const top = ovs.sort((a, b) => b - a).slice(0, 18);
    return { id, s: top.reduce((x, y) => x + y, 0) / Math.max(1, top.length) };
  }).sort((a, b) => b.s - a.s);
  const n = strength.length, third = Math.max(1, Math.round(n / 3));
  const map = new Map<number, Contention>();
  strength.forEach((t, i) => map.set(t.id, i < third ? "contender" : i >= n - third ? "rebuild" : "middle"));
  return map;
}

export type TeamContext = { contention: Contention; markets: Record<FaPos, number[]> };

export async function loadTeamContext(teamId: number, cmap?: Map<number, Contention>): Promise<TeamContext> {
  const roster = await prisma.player.findMany({ where: { teamId, rosterType: "NHL" }, select: SEL });
  const markets: Record<FaPos, number[]> = { F: [], D: [], G: [] };
  for (const p of roster) {
    const { grp, market } = playerMarket(p as PoolPlayer);
    markets[grp].push(market);
  }
  (Object.keys(markets) as FaPos[]).forEach((k) => markets[k].sort((a, b) => b - a));
  const contentionMap = cmap ?? (await teamContentionMap());
  return { contention: contentionMap.get(teamId) ?? "middle", markets };
}

/** Where the player slots on this club: strictly better ratings ahead of him → rank. */
export function projectSlot(ctx: TeamContext, grp: FaPos, market: number): { slot: LineSlot; line: number } {
  const rank = 1 + ctx.markets[grp].filter((m) => m > market).length;
  const slot = slotForRank(grp, rank);
  return { slot, line: slotToLine(slot) };
}

export type TeamAsk = {
  grp: FaPos; base: Demand; slot: LineSlot; line: number;
  contention: Contention; desired: Desired; ask: Demand;
};

/** The Interest feedback: what the player would want to sign at THIS club, given
 *  the role he projects into there + whether the club is a contender. */
export async function teamAsk(playerId: number, teamId: number, pool?: MarketRow[], cmap?: Map<number, Contention>, round?: number): Promise<TeamAsk | null> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { ...SEL, age: true, faDemandOverride: true, df: true } });
  if (!p) return null;
  const marketPool = pool ?? (await loadMarketPool());
  const fullGP = await leagueFullGP();
  const rnd = round ?? (await currentFrenzyRound());
  const { grp, market } = playerMarket(p as PoolPlayer);
  const { anchor, count } = anchorFromPool(marketPool, grp, market);
  const base = buildDemand({ market, grp, age: p.age, anchor, comps: count, override: p.faDemandOverride, capGrowth: 1, round: rnd, downSeason: isDownSeason(p.lastSeasonGP, fullGP), morale: p.morale });

  const ctx = await loadTeamContext(teamId, cmap);
  const { slot, line } = projectSlot(ctx, grp, market);
  const desired = desiredDeployment(grp, line, p.df);
  // projected ask = the club gives him the role he projects into, plus the ST he wants
  const projDeploy: Deployment = { line, pp: desired.wantPP, pk: desired.wantPK };
  const ask = deploymentDemand(base, grp, projDeploy, desired, ctx.contention);
  return { grp, base, slot, line, contention: ctx.contention, desired, ask };
}

/** Evaluate a concrete offer (money + term + promised deployment) at a club. */
export async function evaluateTeamOffer(
  playerId: number, teamId: number, salary: number, years: number, deploy: Deployment,
  pool?: MarketRow[], cmap?: Map<number, Contention>, round?: number,
): Promise<{ acceptable: boolean; ask: Demand; utility: number; base: TeamAsk } | null> {
  const info = await teamAsk(playerId, teamId, pool, cmap, round);
  if (!info) return null;
  const ask = deploymentDemand(info.base, info.grp, deploy, info.desired, info.contention);
  const acceptable = offerAcceptable(ask, salary, years);
  const utility = offerUtility(salary, info.grp, deploy, info.desired, info.contention);
  return { acceptable, ask, utility, base: info };
}

/** Batch-value a set of players (e.g. the whole free-agent board) against one pool. */
export async function demandForPlayers(
  players: Array<PoolPlayer & { id: number; age: number | null; faDemandOverride: number | null }>,
  pool?: MarketRow[],
): Promise<Map<number, DemandFor>> {
  const marketPool = pool ?? (await loadMarketPool());
  const fullGP = await leagueFullGP();
  const round = await currentFrenzyRound();
  const out = new Map<number, DemandFor>();
  for (const p of players) out.set(p.id, demandFromRow(p, marketPool, fullGP, round));
  return out;
}
