"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/** Admin resolves a trade condition once its future terms are met (or lapse). */
export async function resolveCondition(id: number, status: "FULFILLED" | "EXPIRED" | "PENDING") {
  const c = await prisma.tradeCondition.findUnique({ where: { id } });
  if (!c) throw new Error("Condition not found");
  await prisma.tradeCondition.update({
    where: { id },
    data: { status, resolvedAt: status === "PENDING" ? null : new Date() },
  });
  if (status === "FULFILLED") {
    const [from, to] = await Promise.all([
      prisma.team.findUnique({ where: { id: c.fromTeamId }, select: { name: true } }),
      prisma.team.findUnique({ where: { id: c.toTeamId }, select: { name: true } }),
    ]);
    await prisma.transaction.create({
      data: { type: "TRADE", message: `Condition met (${from?.name} → ${to?.name}): ${c.description}` },
    });
  }
  revalidatePath("/admin/conditions");
  revalidatePath("/tools/all-rosters");
  return { status };
}
