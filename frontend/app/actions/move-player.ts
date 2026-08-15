"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canAddCapHit } from "@/lib/cap";
import { money } from "@/lib/finance";

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
    // a one-way contract can't be buried in the minors
    if (player.contractType === "ONE_WAY") return { ok: false, error: "One-way contract — cannot be sent to the farm." };
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

    // in-season: a manual call-up must fit under the cap (ceiling incl. LTIR relief).
    // The off-season +10% cushion is applied automatically inside canAddCapHit.
    const cap = await canAddCapHit(parentTeam.id, player.capHit ?? 0);
    if (!cap.ok) {
      return { ok: false, error: `Call-up blocked — ${parentTeam.name} has ${money(cap.status.space)} of cap space, ${player.name}'s hit is ${money(player.capHit ?? 0)}. Send a player down or use LTIR relief.` };
    }

    await prisma.player.update({
      where: {
        id: playerId,
      },
      data: {
        rosterType: "NHL",
        teamId: parentTeam.id,
      },
    });
    await (prisma as any).transaction.create({
      data: {
        type: "CALL_UP",
        message: `${player.name} recalled from AHL`,
      },
    });
  }

  revalidatePath("/teams");
}