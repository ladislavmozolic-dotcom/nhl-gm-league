"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { posGroup } from "@/lib/ratingBands";

// Game-day dressed lineup: exactly 20 of the 23-man NHL roster suit up —
// 12 forwards, 6 defensemen, 2 goalies. Anyone else on the NHL side must be a
// healthy scratch (Player.scratched). See memory: roster-farm-mechanics.
export const DRESS_TARGET = { F: 12, D: 6, G: 2 } as const;

export type RosterComplianceResult =
  | { ok: false }
  | { ok: true; compliant: true }
  | { ok: true; compliant: false; teamSlug: string; teamName: string; counts: { F: number; D: number; G: number } };

/** Does the current GM's dressed (NHL, non-scratched) roster match 12F/6D/2G? */
export async function rosterComplianceAction(): Promise<RosterComplianceResult> {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false };
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { slug: true, name: true } });
  if (!team) return { ok: false };
  const dressed = await prisma.player.findMany({
    where: { teamId, rosterType: "NHL", scratched: false },
    select: { position: true, isGoalie: true },
  });
  const counts = { F: 0, D: 0, G: 0 };
  for (const p of dressed) counts[posGroup(p.position, p.isGoalie)]++;
  if (counts.F === DRESS_TARGET.F && counts.D === DRESS_TARGET.D && counts.G === DRESS_TARGET.G) return { ok: true, compliant: true };
  return { ok: true, compliant: false, teamSlug: team.slug, teamName: team.name, counts };
}
