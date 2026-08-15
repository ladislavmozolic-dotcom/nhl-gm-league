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
  console.log("CREATING TRANSACTION");
  // Prisma client may not expose a 'transaction' property in some setups; use any cast to access model dynamically
  await (prisma as any).transaction.create({
    data: {
      type: "WAIVER",
      message: `${player.name} placed on waivers`,
    },
  });
  console.log("TRANSACTION CREATED");

  revalidatePath("/teams");
  revalidatePath("/waivers");
  revalidatePath("/transactions");
}