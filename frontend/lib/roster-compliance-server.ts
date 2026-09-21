"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { posGroup } from "@/lib/ratingBands";
import { DRESS_TARGET } from "@/lib/roster-rules";

// A "use server" file may only export async functions — DRESS_TARGET (a plain
// object) lives in lib/roster-rules.ts instead; re-exporting it from here broke
// EVERY server action in the app (Next.js refused to build the actions
// manifest), not just this one — see the "A 'use server' file can only export
// async functions" error. Import DRESS_TARGET directly from roster-rules.

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
