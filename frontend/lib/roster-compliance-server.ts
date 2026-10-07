"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { posGroup } from "@/lib/ratingBands";
import { DRESS_TARGET } from "@/lib/roster-rules";
import { teamCapStatus } from "@/lib/cap";
import { getBank } from "@/lib/league-bank-server";

// A "use server" file may only export async functions — DRESS_TARGET (a plain
// object) lives in lib/roster-rules.ts instead; re-exporting it from here broke
// EVERY server action in the app (Next.js refused to build the actions
// manifest), not just this one — see the "A 'use server' file can only export
// async functions" error. Import DRESS_TARGET directly from roster-rules.

export type SideCounts = { F: number; D: number; G: number };
export type ComplianceSide = { level: "NHL" | "AHL"; teamName: string; counts: SideCounts };

export type CapProblem = { kind: "over" | "under"; amount: number; limit: number; committed: number };
export type FineInfo = { nhlRoster: number; ahlRoster: number; cap: number; floor: number; active: boolean };
export type RosterComplianceResult =
  | { ok: false }
  | { ok: true; compliant: true }
  | { ok: true; compliant: false; teamSlug: string; sides: ComplianceSide[]; cap: CapProblem | null; fines: FineInfo; noCallupGroups: ("F" | "D" | "G")[] };

const countDressed = async (teamId: number, rosterType: "NHL" | "AHL"): Promise<SideCounts> => {
  const dressed = await prisma.player.findMany({
    where: { teamId, rosterType, scratched: false },
    select: { position: true, isGoalie: true },
  });
  const counts: SideCounts = { F: 0, D: 0, G: 0 };
  for (const p of dressed) counts[posGroup(p.position, p.isGoalie)]++;
  return counts;
};

const isOff = (c: SideCounts) => c.F !== DRESS_TARGET.F || c.D !== DRESS_TARGET.D || c.G !== DRESS_TARGET.G;

/** Does the current GM's dressed (non-scratched) NHL and AHL rosters both match 12F/6D/2G? */
export async function rosterComplianceAction(): Promise<RosterComplianceResult> {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false };
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { slug: true, name: true, affiliateTeams: { select: { id: true, name: true } } },
  });
  if (!team) return { ok: false };
  const affiliate = team.affiliateTeams[0] ?? null;

  const [nhlCounts, ahlCounts] = await Promise.all([
    countDressed(teamId, "NHL"),
    affiliate ? countDressed(affiliate.id, "AHL") : Promise.resolve(null),
  ]);

  const sides: ComplianceSide[] = [];
  if (isOff(nhlCounts)) sides.push({ level: "NHL", teamName: team.name, counts: nhlCounts });
  if (ahlCounts && isOff(ahlCounts)) sides.push({ level: "AHL", teamName: affiliate!.name, counts: ahlCounts });

  // Salary cap — over the ceiling is a problem in any phase (the ceiling already carries the
  // off-season cushion); the floor only bites in the regular season.
  const capStatus = await teamCapStatus(teamId);
  let cap: CapProblem | null = null;
  if (capStatus.overBy > 0) cap = { kind: "over", amount: Math.round(capStatus.overBy), limit: Math.round(capStatus.ceiling), committed: Math.round(capStatus.committed) };
  else if (capStatus.underFloorBy > 0 && capStatus.phase === "regular") cap = { kind: "under", amount: Math.round(capStatus.underFloorBy), limit: Math.round(capStatus.floor), committed: Math.round(capStatus.committed) };

  if (!sides.length && !cap) return { ok: true, compliant: true };

  // Which short groups can NOT be filled from the farm — $100k minor-league deals never get called up,
  // so a club whose only spare goalie/D/F is on one has to acquire a real NHL contract.
  const noCallupGroups: ("F" | "D" | "G")[] = [];
  const nhlSide = sides.find((x) => x.level === "NHL");
  if (nhlSide && affiliate) {
    const pool = await prisma.player.findMany({
      where: { teamId: affiliate.id, rosterType: "AHL", injuryDaysLeft: { lte: 0 }, contractYears: { gt: 0 }, NOT: { capHit: 100_000 } },
      select: { position: true, isGoalie: true },
    });
    const have = new Set(pool.map((p) => posGroup(p.position, p.isGoalie)));
    for (const g of ["F", "D", "G"] as const) if (nhlSide.counts[g] < DRESS_TARGET[g] && !have.has(g)) noCallupGroups.push(g);
  }

  const bank = await getBank();
  const fines: FineInfo = {
    nhlRoster: bank.nhlRosterFine, ahlRoster: bank.ahlRosterFine,
    cap: bank.capFinePerDay ?? 200000, floor: bank.floorFinePerDay ?? bank.capFinePerDay ?? 200000,
    active: bank.enforcementEnabled,
  };
  return { ok: true, compliant: false, teamSlug: team.slug, sides, cap, fines, noCallupGroups };
}
