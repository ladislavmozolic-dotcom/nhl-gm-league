"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { posGroup } from "@/lib/ratingBands";

// Game-day dressed lineup: exactly 20 of the 23-man NHL roster suit up —
// 12 forwards, 6 defensemen, 2 goalies — and the same 12/6/2 split applies to
// the 20-man active AHL roster. Anyone else on either side must be a healthy
// scratch (Player.scratched). See memory: roster-farm-mechanics.
export const DRESS_TARGET = { F: 12, D: 6, G: 2 } as const;

export type SideCounts = { F: number; D: number; G: number };
export type ComplianceSide = { level: "NHL" | "AHL"; teamName: string; counts: SideCounts };

export type RosterComplianceResult =
  | { ok: false }
  | { ok: true; compliant: true }
  | { ok: true; compliant: false; teamSlug: string; sides: ComplianceSide[] };

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

  if (!sides.length) return { ok: true, compliant: true };
  return { ok: true, compliant: false, teamSlug: team.slug, sides };
}
