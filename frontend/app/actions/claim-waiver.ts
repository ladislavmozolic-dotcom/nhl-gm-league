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
  await (prisma as any).transaction.create({
  data: {
    type: "CLAIM",
    message: `${player.name} claimed off waivers`,
  },
});

  revalidatePath("/waivers");
}