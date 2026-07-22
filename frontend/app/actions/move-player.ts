"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function movePlayer(
  playerId: number,
  rosterType: "NHL" | "AHL"
) {
  const player = await prisma.player.findUnique({
    where: {
      id: playerId,
    },
    include: {
      team: {
        include: {
          affiliateTeams: true,
          parentTeam: true,
        },
      },
    },
  });

  if (!player) return;

  if (rosterType === "AHL") {
    const affiliateTeam = player.team.affiliateTeams?.[0];

    if (!affiliateTeam) return;

    await prisma.player.update({
      where: {
        id: playerId,
      },
      data: {
        rosterType: "AHL",
        teamId: affiliateTeam.id,
      },
    });
  }

  if (rosterType === "NHL") {
    const parentTeam = player.team.parentTeam;

    if (!parentTeam) return;

    await prisma.player.update({
      where: {
        id: playerId,
      },
      data: {
        rosterType: "NHL",
        teamId: parentTeam.id,
      },
    });
  }

  revalidatePath("/teams");
}