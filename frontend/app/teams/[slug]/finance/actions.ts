"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { getArenaSections, type ArenaSection } from "@/lib/finance";
import { revalidatePath } from "next/cache";

export async function saveTicketPrices(slug: string, prices: number[]) {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, capacity: true, arenaSections: true } });
  if (!team) throw new Error("Team not found");
  const session = await getTeamSession();
  if (session !== team.id) throw new Error("Not authorized for this team");

  const sections = getArenaSections(team);
  const updated: ArenaSection[] = sections.map((s, i) => ({
    ...s, price: Math.max(0, Math.round(prices[i] ?? s.price)),
  }));
  await prisma.team.update({ where: { id: team.id }, data: { arenaSections: updated } });
  revalidatePath(`/teams/${slug}/finance`);
}
