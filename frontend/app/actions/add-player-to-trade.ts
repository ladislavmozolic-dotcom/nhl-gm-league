"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addPlayerToTrade(
  tradeId: number,
  playerId: number,
  side: string
) {
  await (prisma as any).tradeAsset.create({
    data: {
      tradeId,
      playerId,
      assetType: "PLAYER",
      side,
    },
  });

  revalidatePath(`/trades/${tradeId}`);
}