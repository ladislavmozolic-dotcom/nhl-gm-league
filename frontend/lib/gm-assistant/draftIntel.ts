import { prisma } from "@/lib/prisma";
import { compositeRating } from "./leagueSlots";
import { isPos } from "./playerFit";
import type { DraftSourceWhere } from "@/lib/draft-source";

// UNHL Intelligence — "Draft Intelligence" (phase 5 — see memory:
// gm-assistant-intelligence). Splits the pick into separate, explainable
// lenses instead of one auto-pick recommendation: Best Player Available,
// Highest Upside, Lowest Risk, Position Need, Best Org Fit, and — where the
// data actually supports it — how similarly-rated past draft classes turned
// out. Every number here (ov, potential, csRank) is a real derived rating
// already stored on DraftProspect; nothing here invents scouting data the DB
// doesn't have, and a class with no linked graduated players just shows an
// empty comparables list rather than a guess.

export type ProspectPos = "C" | "LW" | "RW" | "D" | "G";
const POSITIONS: ProspectPos[] = ["C", "LW", "RW", "D", "G"];

export interface AvailableProspect {
  id: number; name: string; position: string; country: string | null;
  ov: number; potential: number; csRank: number | null;
}

export interface BpaEntry { id: number; name: string; position: string; country: string | null; ov: number; potential: number; csRank: number | null; }
export interface RiskEntry extends BpaEntry { gap: number; } // potential - ov, smaller = closer to a finished product

export interface PositionNeed {
  position: ProspectPos;
  teamRating: number | null; // null = nobody rostered at this position at all
  leagueMedian: number;
  delta: number | null;
  rank: number | null;
  outOf: number;
}

export interface OutcomeComp {
  draftYear: number;
  overallPick: number | null;
  name: string;
  draftOv: number;
  draftPotential: number;
  nowRating: number | null; // current CK/PA/SC/DF composite (or goalie overall) of the player he became — null if he never made an NHL roster here
}

export interface DraftIntelResult {
  bpa: BpaEntry[];
  upside: BpaEntry[];
  lowestRisk: RiskEntry[];
  positionNeeds: PositionNeed[];
  bestOrgFit: { position: ProspectPos; delta: number | null; prospects: BpaEntry[] } | null;
  comparables: { forProspect: string; picks: OutcomeComp[] };
}

const toBpa = (p: AvailableProspect): BpaEntry => ({ id: p.id, name: p.name, position: p.position, country: p.country, ov: p.ov, potential: p.potential, csRank: p.csRank });

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Same "average of whatever's rostered at this position, across all 32
 *  clubs" pattern leagueSlots.ts uses for line slots — here at the coarser
 *  C/LW/RW/D/G grain that actually matches a draft prospect's position. */
async function positionNeeds(teamId: number): Promise<PositionNeed[]> {
  const [skaters, goalies] = await Promise.all([
    prisma.player.findMany({
      where: { team: { league: "NHL", isAffiliate: false }, rosterType: "NHL", isGoalie: false, scratched: false },
      select: { teamId: true, position: true, ck: true, pa: true, sc: true, df: true },
    }),
    prisma.player.findMany({
      where: { team: { league: "NHL", isAffiliate: false }, rosterType: "NHL", isGoalie: true, scratched: false },
      select: { teamId: true, goalieRating: { select: { overall: true } } },
    }),
  ]);

  return POSITIONS.map((pos) => {
    const sums = new Map<number, { sum: number; n: number }>();
    if (pos === "G") {
      for (const g of goalies) {
        const r = g.goalieRating?.overall;
        if (r == null) continue;
        const e = sums.get(g.teamId) ?? { sum: 0, n: 0 };
        e.sum += r; e.n += 1; sums.set(g.teamId, e);
      }
    } else {
      for (const s of skaters) {
        if (!isPos(s.position ?? "", pos)) continue;
        const r = compositeRating(s);
        if (r == null) continue;
        const e = sums.get(s.teamId) ?? { sum: 0, n: 0 };
        e.sum += r; e.n += 1; sums.set(s.teamId, e);
      }
    }
    const rows = [...sums.entries()].map(([tid, e]) => ({ teamId: tid, avg: e.sum / e.n })).sort((a, b) => b.avg - a.avg);
    const leagueMedian = Math.round(median(rows.map((r) => r.avg)) * 10) / 10;
    const mine = rows.find((r) => r.teamId === teamId);
    return {
      position: pos,
      teamRating: mine ? Math.round(mine.avg * 10) / 10 : null,
      leagueMedian,
      delta: mine ? Math.round((mine.avg - leagueMedian) * 10) / 10 : null,
      rank: mine ? rows.filter((r) => r.avg > mine.avg).length + 1 : null,
      outOf: rows.length,
    };
  });
}

/** For the top Best-Player-Available prospect, past picks from the same
 *  roster-mode draft history (never mixing ProfiNHL's own classes with
 *  imported real ones — see draft-source.ts) at the same position with a
 *  similar draft-day ov/potential, and the current rating of whoever they
 *  became. A pick with no playerId (never developed into a rostered player)
 *  or a player who fell off the NHL roster (no rating available) is left
 *  out — not backfilled. */
async function comparablePastPicks(target: BpaEntry, draftYear: number, sourceWhere: DraftSourceWhere, limit = 5): Promise<OutcomeComp[]> {
  const past = await prisma.draftProspect.findMany({
    where: { draftYear: { lt: draftYear }, ...sourceWhere, position: target.position, playerId: { not: null } },
    select: { draftYear: true, overallPick: true, name: true, ov: true, potential: true, playerId: true },
  });
  if (!past.length) return [];

  const players = await prisma.player.findMany({
    where: { id: { in: past.map((p) => p.playerId as number) } },
    select: { id: true, isGoalie: true, ck: true, pa: true, sc: true, df: true, goalieRating: { select: { overall: true } } },
  });
  const playerById = new Map(players.map((p) => [p.id, p]));

  return past
    .map((p) => {
      const dOv = p.ov - target.ov, dPot = p.potential - target.potential;
      const distance = Math.sqrt(dOv * dOv + dPot * dPot);
      const player = playerById.get(p.playerId as number);
      const nowRating = player ? (player.isGoalie ? (player.goalieRating?.overall ?? null) : compositeRating(player)) : null;
      return { draftYear: p.draftYear, overallPick: p.overallPick, name: p.name, draftOv: p.ov, draftPotential: p.potential, nowRating, distance };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((c) => ({ draftYear: c.draftYear, overallPick: c.overallPick, name: c.name, draftOv: c.draftOv, draftPotential: c.draftPotential, nowRating: c.nowRating }));
}

export async function draftIntelligence(teamId: number, draftYear: number, available: AvailableProspect[], sourceWhere: DraftSourceWhere): Promise<DraftIntelResult | null> {
  const scoutable = available.filter((p) => p.ov > 0);
  if (!scoutable.length) return null;

  const bpa = [...scoutable].sort((a, b) => b.ov - a.ov).slice(0, 6).map(toBpa);
  const upside = [...scoutable].sort((a, b) => b.potential - a.potential).slice(0, 6).map(toBpa);
  // "Lowest risk" means safest bet among players actually worth a pick, not
  // whichever late-class fringe name happens to have the smallest OV/POT gap
  // (a 47 OV prospect isn't "safe", he's irrelevant either way) — a 7-round
  // class skews low enough that even the population median doesn't clear
  // that bar, so this is scored only within the top-40 names by OV (roughly
  // the first two rounds of a 32-team league — a plain, stated cutoff).
  const RISK_POOL = 40;
  const riskPool = [...scoutable].sort((a, b) => b.ov - a.ov).slice(0, RISK_POOL);
  const lowestRisk: RiskEntry[] = riskPool
    .map((p) => ({ ...toBpa(p), gap: p.potential - p.ov }))
    .sort((a, b) => a.gap - b.gap || b.ov - a.ov)
    .slice(0, 6);

  const needs = await positionNeeds(teamId);
  const worstNeed = [...needs].filter((n) => n.rank != null).sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))[0] ?? null;
  const bestOrgFit = worstNeed
    ? {
        position: worstNeed.position, delta: worstNeed.delta,
        prospects: scoutable.filter((p) => p.position === worstNeed.position).sort((a, b) => b.ov - a.ov).slice(0, 5).map(toBpa),
      }
    : null;

  const top = bpa[0];
  const comparables = top ? await comparablePastPicks(top, draftYear, sourceWhere) : [];

  return { bpa, upside, lowestRisk, positionNeeds: needs, bestOrgFit, comparables: { forProspect: top?.name ?? "", picks: comparables } };
}
