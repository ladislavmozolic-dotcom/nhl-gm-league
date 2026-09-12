"use server";

import { loadSettings, saveSettings } from "@/lib/sim/settings";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { revalidatePath } from "next/cache";

export async function updateSalaryRetentionSettings(formData: FormData) {
  if (!(await isAdmin())) throw new Error("Unauthorized");

  const retentionMaxPlayersIn = Number(formData.get("retentionMaxPlayersIn") ?? 3);
  const retentionMaxPlayersOut = Number(formData.get("retentionMaxPlayersOut") ?? 3);
  const retentionMaxTotalPct = Number(formData.get("retentionMaxTotalPct") ?? 10);
  const retentionMaxPct = Number(formData.get("retentionMaxPct") ?? 50);

  const settings = await loadSettings();
  settings.retentionMaxPlayersIn = retentionMaxPlayersIn;
  settings.retentionMaxPlayersOut = retentionMaxPlayersOut;
  settings.retentionMaxTotalPct = retentionMaxTotalPct;
  settings.retentionMaxPct = retentionMaxPct;

  await saveSettings(settings);
  revalidatePath("/admin/salary-retention");
  revalidatePath("/admin");
}

/** Cancel one active trade-retention record (a Buyout row with totalCost=0).
 *  Recomputes the player's `retainedSalary` from whatever active retention
 *  records remain on him, rather than just subtracting this one, so a
 *  player retained twice (a 2nd retention on the same contract) ends up
 *  with the correct remaining total either way. */
export async function removeRetention(buyoutId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };

  const record = await prisma.buyout.findUnique({ where: { id: buyoutId } });
  if (!record || record.totalCost !== 0) return { ok: false, error: "Retention record not found." };

  await prisma.buyout.delete({ where: { id: buyoutId } });

  if (record.playerId) {
    const remaining = await prisma.buyout.findMany({
      where: { playerId: record.playerId, totalCost: 0 },
      select: { perYear: true, startYear: true, years: true },
    });
    const activeTotal = remaining
      .filter((r) => CURRENT_SEASON_START < r.startYear + r.years)
      .reduce((sum, r) => sum + r.perYear, 0);
    await prisma.player.update({ where: { id: record.playerId }, data: { retainedSalary: activeTotal } });
  }

  revalidatePath("/admin/salary-retention");
  return { ok: true };
}
