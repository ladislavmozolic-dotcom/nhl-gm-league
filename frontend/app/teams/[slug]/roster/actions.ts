"use server";

import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type RosterRow = { id: number; number: number | null; captaincy: "C" | "A" | null };

export async function saveRoster(slug: string, rows: RosterRow[]) {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) throw new Error("Team not found");
  if (!(await canManageTeam(team.id))) throw new Error("Not authorized for this team");

  // enforce 1 captain, max 2 alternates
  const caps = rows.filter((r) => r.captaincy === "C").length;
  const alts = rows.filter((r) => r.captaincy === "A").length;
  if (caps > 1) throw new Error("Only one captain allowed");
  if (alts > 2) throw new Error("At most two alternate captains allowed");

  // only touch this team's players
  const ids = new Set((await prisma.player.findMany({ where: { teamId: team.id }, select: { id: true } })).map((p) => p.id));
  await prisma.$transaction(
    rows.filter((r) => ids.has(r.id)).map((r) =>
      prisma.player.update({
        where: { id: r.id },
        data: { number: r.number ?? null, captaincy: r.captaincy },
      })),
  );
  revalidatePath(`/teams/${slug}/roster`);
  revalidatePath(`/teams/${slug}`);
  revalidatePath(`/teams/${slug}/lines/captains`);
  revalidatePath("/captains");
}
