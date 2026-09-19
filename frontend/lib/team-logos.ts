"use server";

import { prisma } from "./prisma";

/** teamId -> logoUrl for every club in a league. Cheap, single-purpose lookup
 *  for pages that build their team rows elsewhere and just need the crest. */
export async function teamLogoMap(league = "NHL"): Promise<Map<number, string | null>> {
  const teams = await prisma.team.findMany({ where: { league }, select: { id: true, logoUrl: true } });
  return new Map(teams.map((t) => [t.id, t.logoUrl]));
}
