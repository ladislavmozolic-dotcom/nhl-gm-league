"use server";
import { revalidatePath } from "next/cache";
import { canManageTeam, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { retireNumber, unretireNumber } from "@/lib/retired-numbers-server";

export async function retireNumberAction(slug: string, playerId: number, number: number, note: string) {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) return { ok: false as const, error: "Team not found." };
  if (!(await canManageTeam(team.id))) return { ok: false as const, error: "Only the club's GM can retire a number." };
  try {
    await retireNumber(team.id, playerId, number, note, { asAdmin: await isAdmin() });
    revalidatePath(`/teams/${slug}/retired-numbers`);
    return { ok: true as const };
  } catch (e) { return { ok: false as const, error: (e as Error).message }; }
}

export async function unretireNumberAction(slug: string, id: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  await unretireNumber(id);
  revalidatePath(`/teams/${slug}/retired-numbers`);
  return { ok: true as const };
}
