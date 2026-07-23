"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleTradeBlock(
  playerId: number,
  value: boolean
) {
  await prisma.player.update({
    where: {
      id: playerId,
    },
    data: {
      onTradeBlock: value,
    },
  });

  revalidatePath("/teams");
  revalidatePath("/trade-block");
}