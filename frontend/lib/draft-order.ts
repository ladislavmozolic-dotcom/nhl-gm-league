// Draft order for rounds 2-7: reverse regular-season standings (worst picks first),
// with traded-pick ownership from DraftPick. (Round 1 already ran in-league; the
// lottery only ever affects round 1, so rounds 2-7 are pure reverse-standings.)
// The slot of each pick is fixed by the ORIGINAL team's standings position; whoever
// currently owns that (original-team, round) pick makes the selection.

import { prisma } from "./prisma";
import { computeStandings } from "./sim/standings";

export const PICKS_PER_ROUND = 32;

export type OrderPick = {
  overallPick: number;
  round: number;
  slotInRound: number;   // 0-based index within the round
  pickerTeamId: number;  // who selects (current owner)
  originalTeamId: number; // whose standings slot this is
  deferred?: boolean;     // a pick that expired and moved to the end
  sourcePick?: number;    // for a deferred pick, the base pick it came from
};

/** Full pick order for rounds 2-7 of a draft year. */
export async function draftOrder(year: number, season = "2026-27"): Promise<OrderPick[]> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const source = cfg?.rosterMode === "real" ? "real" : "profinhl";

  const bonusSource = source === "real" ? { source: "real" } : { OR: [{ source: null }, { source: "profinhl" }] };
  const [standings, teams, picks, lottery, bonus] = await Promise.all([
    computeStandings(season, "NHL"),
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, profinhlLogoId: true } }),
    prisma.draftPick.findMany({ where: { year, source }, select: { round: true, teamId: true, ownerLogoId: true } }),
    prisma.draftLottery.findMany({ where: { year }, orderBy: { pick: "asc" }, select: { pick: true, teamId: true } }),
    prisma.draftBonusPick.findMany({ where: { year, ...bonusSource }, orderBy: [{ round: "asc" }, { seq: "asc" }, { id: "asc" }], select: { round: true, teamId: true } }),
  ]);
  const logoOf = new Map(teams.map((t) => [t.id, t.profinhlLogoId]));
  // owner lookup: (round, originalOwnerLogoId) -> current owner teamId
  const ownerByRoundLogo = new Map<string, number>();
  for (const p of picks) ownerByRoundLogo.set(`${p.round}:${p.ownerLogoId}`, p.teamId);

  const out: OrderPick[] = [];

  // Round 1 = the committed draft lottery (picks 1-16 lottery, 17-32 by playoff
  // finish). Only present once a lottery is stored for this year; without it the
  // draft room keeps its "round 1 already ran in-league" behaviour untouched.
  for (const r of lottery) {
    const logo = logoOf.get(r.teamId);
    const owner = logo != null ? ownerByRoundLogo.get(`1:${logo}`) : undefined; // traded 1st-rounders
    out.push({ overallPick: r.pick, round: 1, slotInRound: r.pick - 1, pickerTeamId: owner ?? r.teamId, originalTeamId: r.teamId });
  }

  // worst-first slot order
  const slotOrder = [...standings].reverse().map((s) => s.teamId);

  for (let round = 2; round <= 7; round++) {
    slotOrder.forEach((originalTeamId, slot) => {
      const logo = logoOf.get(originalTeamId);
      const owner = logo != null ? ownerByRoundLogo.get(`${round}:${logo}`) : undefined;
      out.push({
        overallPick: (round - 1) * PICKS_PER_ROUND + slot + 1,
        round, slotInRound: slot,
        pickerTeamId: owner ?? originalTeamId, // no trade record → original team keeps it
        originalTeamId,
      });
    });
  }

  // Extra rounds (8, 9, …): admin-granted bonus picks, numbered contiguously right
  // after round 7 and grouped by round in the order they were awarded.
  const roundCounters = new Map<number, number>();
  let nextBonusPick = LAST_BASE_PICK + 1;
  for (const b of bonus) {
    const slot = roundCounters.get(b.round) ?? 0;
    roundCounters.set(b.round, slot + 1);
    const logo = logoOf.get(b.teamId);
    const owner = logo != null ? ownerByRoundLogo.get(`${b.round}:${logo}`) : undefined; // bonus picks can be traded too
    out.push({ overallPick: nextBonusPick++, round: b.round, slotInRound: slot, pickerTeamId: owner ?? b.teamId, originalTeamId: b.teamId });
  }
  return out;
}

/** Bonus/extra rounds present for a year (8, 9, …), ascending — drives the room's
 *  round switcher and the "open round" controls beyond the standard seven. */
export async function bonusRoundsFor(year: number): Promise<number[]> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const bonusSource = cfg?.rosterMode === "real" ? { source: "real" } : { OR: [{ source: null }, { source: "profinhl" as string | null }] };
  const rows = await prisma.draftBonusPick.groupBy({ by: ["round"], where: { year, ...bonusSource }, orderBy: { round: "asc" } });
  return rows.map((r) => r.round);
}

/** Worst-first team order (the fixed slot order every round is built on). The
 *  ORIGINAL owner of overall pick N is `order[(N-1) % 32]`, any round. */
export async function reverseStandingsOrder(season = "2026-27"): Promise<number[]> {
  const standings = await computeStandings(season, "NHL");
  return [...standings].reverse().map((s) => s.teamId);
}

export const LAST_BASE_PICK = 7 * PICKS_PER_ROUND; // 224 — after this come deferred picks

/** The draft order INCLUDING expired picks that were moved to the end (deferrals),
 *  appended in the order they were missed with overall picks 225, 226, … */
export async function effectiveOrder(year: number, season = "2026-27"): Promise<OrderPick[]> {
  const [base, deferrals] = await Promise.all([
    draftOrder(year, season),
    prisma.draftDeferral.findMany({ where: { year }, orderBy: { id: "asc" } }),
  ]);
  const revStd = await reverseStandingsOrder(season);
  // deferrals sit after everything scheduled — including any bonus rounds
  const lastScheduled = base.reduce((m, p) => Math.max(m, p.overallPick), LAST_BASE_PICK);
  const tail: OrderPick[] = deferrals.map((d, i) => ({
    overallPick: lastScheduled + i + 1,
    round: d.round,
    slotInRound: -1,
    pickerTeamId: d.teamId,
    originalTeamId: revStd[(d.sourcePick - 1) % PICKS_PER_ROUND] ?? d.teamId,
    deferred: true,
    sourcePick: d.sourcePick,
  }));
  return [...base, ...tail];
}

/** The single pick at a given overall number (or null if out of the 2-7 range). */
export async function pickAt(year: number, overallPick: number, season = "2026-27"): Promise<OrderPick | null> {
  const order = await effectiveOrder(year, season);
  return order.find((p) => p.overallPick === overallPick) ?? null;
}
