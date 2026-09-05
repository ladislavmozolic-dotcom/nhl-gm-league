"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleTradeBlock(
  playerId: number,
  value: boolean
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
      onTradeBlock: value,
    },
  });

  await (prisma as any).transaction.create({
    data: {
      type: "TRADE_BLOCK",
      playerId,
      message: value
        ? `${player.name} added to trade block`
        : `${player.name} removed from trade block`,
    },
  });

  revalidatePath("/teams");
  revalidatePath("/trade-block");
}