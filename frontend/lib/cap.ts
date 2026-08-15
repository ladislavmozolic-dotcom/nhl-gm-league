// One place for salary-cap compliance. The effective ceiling is the phase
// ceiling (strict in-season, +10% off-season cushion) plus LTIR relief; a legal
// club sits between the lower limit (floor) and that ceiling.

import { prisma } from "./prisma";
import { getLeagueClock } from "./calendar-server";
import { loadLeagueCap } from "./free-agency-server";
import { capCeilingForPhase, ltirRelief } from "./finance";

export type CapStatus = {
  committed: number; ltir: number; ceiling: number; space: number;
  floor: number; underFloorBy: number; overBy: number;
  phase: string; cushioned: boolean; compliant: boolean;
};

/** Cap status for one club. Pass `phaseOverride` (e.g. "regular") to test
 *  compliance against a different phase — used for the opening-day check. */
export async function teamCapStatus(teamId: number, phaseOverride?: string): Promise<CapStatus> {
  const [roster, team, cap, clock] = await Promise.all([
    prisma.player.findMany({ where: { teamId, rosterType: "NHL" }, select: { capHit: true, injuryDaysLeft: true, condition: true, isGoalie: true } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { retainsBuyouts: true } }),
    loadLeagueCap(),
    getLeagueClock(),
  ]);
  const phase = phaseOverride ?? clock.phase;
  const committed = roster.reduce((s, p) => s + (p.capHit ?? 0), 0) + (team?.retainsBuyouts ?? 0);
  const ltir = ltirRelief(roster);
  const ceiling = capCeilingForPhase(cap.upper, phase) + ltir;
  const floor = cap.lower;
  return {
    committed, ltir, ceiling, space: ceiling - committed, floor,
    underFloorBy: Math.max(0, floor - committed),
    overBy: Math.max(0, committed - ceiling),
    phase, cushioned: phase !== "regular" && phase !== "playoffs",
    compliant: committed <= ceiling && committed >= floor,
  };
}

export type CapOffender = { teamId: number; code: string | null; name: string; over: number; underFloor: number };

/** Every non-compliant NHL club, judged against `phase` (defaults to now). */
export async function leagueCapCompliance(phase?: string): Promise<CapOffender[]> {
  const teams = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, code: true, name: true } });
  const out: CapOffender[] = [];
  for (const t of teams) {
    const s = await teamCapStatus(t.id, phase);
    if (s.overBy > 0 || s.underFloorBy > 0) out.push({ teamId: t.id, code: t.code, name: t.name, over: s.overBy, underFloor: s.underFloorBy });
  }
  return out;
}

/** Would adding `addHit` to this club's cap keep it legal for the current phase?
 *  (Used to gate in-season call-ups / waiver claims / signings.) */
export async function canAddCapHit(teamId: number, addHit: number): Promise<{ ok: boolean; status: CapStatus }> {
  const status = await teamCapStatus(teamId);
  return { ok: status.committed + addHit <= status.ceiling, status };
}
