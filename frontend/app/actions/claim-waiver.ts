"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function claimWaiver(
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
      waiverStatus: "CLAIMED",
    },
  });
  const team = player.teamId ? await prisma.team.findUnique({ where: { id: player.teamId }, select: { code: true } }) : null;
  const teamTag = team?.code ? ` (${team.code})` : "";
  await (prisma as any).transaction.create({
    data: {
      type: "CLAIM",
      playerId: player.id,
      teamId: player.teamId,
      message: `${player.name}${teamTag} claimed off waivers`,
    },
  });

  revalidatePath("/waivers");
}