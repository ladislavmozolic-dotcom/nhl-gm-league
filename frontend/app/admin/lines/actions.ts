"use server";

import { prisma } from "@/lib/prisma";
import { runAutoSimIfDue, playNextSimDay } from "@/lib/sim/auto";
import { revalidatePath } from "next/cache";

export async function setAutoSim(enabled: boolean, hour: number, minute: number) {
  await prisma.autoSim.upsert({
    where: { id: 1 },
    create: { id: 1, enabled, hour, minute },
    update: { enabled, hour, minute },
  });
  revalidatePath("/admin/lines");
}

/** Manually play the next scheduled day now (same as the scheduled run). */
export async function runSimNow() {
  const res = await playNextSimDay();
  revalidatePath("/admin/lines"); revalidatePath("/standings"); revalidatePath("/schedule"); revalidatePath("/");
  return res;
}

/** Force the due-check (used to verify the scheduler wiring). */
export async function checkDue() {
  return runAutoSimIfDue();
}
