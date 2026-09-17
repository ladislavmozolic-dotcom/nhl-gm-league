"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function waivePlayer(
  playerId: number
) {
  const player = await prisma.player.findUnique({
    where: {
      id: playerId,
    },
  });

  if (!player) return;

  await prisma.player.update({
    where: {
      id: playerId,
    },
    data: {
      waiverStatus: "ON_WAIVERS",
    },
  });
  const team = player.teamId ? await prisma.team.findUnique({ where: { id: player.teamId }, select: { code: true } }) : null;
  const teamTag = team?.code ? ` (${team.code})` : "";
  await (prisma as any).transaction.create({
    data: {
      type: "WAIVER",
      playerId: player.id,
      teamId: player.teamId,
      message: `${player.name}${teamTag} was placed on waivers.`,
    },
  });

  revalidatePath("/teams");
  revalidatePath("/waivers");
  revalidatePath("/transactions");
}