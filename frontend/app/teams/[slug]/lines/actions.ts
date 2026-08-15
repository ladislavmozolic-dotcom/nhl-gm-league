"use server";

import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { saveTeamLines, type TeamLinesData } from "@/lib/sim/lines";
import { revalidatePath } from "next/cache";

export async function saveLines(slug: string, data: TeamLinesData) {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) throw new Error("Team not found");
  if (!(await canManageTeam(team.id))) throw new Error("Not authorized for this team");
  await saveTeamLines(team.id, data);
  revalidatePath(`/teams/${slug}/lines`);
}
