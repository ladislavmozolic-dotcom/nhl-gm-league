"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createTrade(
  fromTeamId: number,
  toTeamId: number
) {
  await (prisma as any).trade.create({
    data: {
      fromTeamId,
      toTeamId,
      status: "PENDING",
    },
  });

  revalidatePath("/trades");
}