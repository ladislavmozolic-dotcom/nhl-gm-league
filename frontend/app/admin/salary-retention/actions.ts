"use server";

import { loadSettings, saveSettings } from "@/lib/sim/settings";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { revalidatePath } from "next/cache";

export async function updateSalaryRetentionSettings(formData: FormData) {
  if (!(await isAdmin())) throw new Error("Unauthorized");

  const retentionMaxSlots = Number(formData.get("retentionMaxSlots") ?? 3);
  const retentionMaxTotalPct = Number(formData.get("retentionMaxTotalPct") ?? 10);
  const retentionMaxPct = Number(formData.get("retentionMaxPct") ?? 50);

  const settings = await loadSettings();
  settings.retentionMaxSlots = retentionMaxSlots;
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

/** Change one active retention's percentage after the fact — e.g. correcting a
 *  trade that should have retained 20% instead of 50%. Recomputes perYear the
 *  same way lib/trade-exec.ts does when a retention is first applied: a % of
 *  the player's cap hit net of every OTHER active retention on him, rounded to
 *  the nearest $500, and re-checks the same floor/ceiling rules (retentionMinSalary,
 *  retentionMaxPct) so a manual edit can't create a state a real trade couldn't. */
export async function updateRetentionPct(buyoutId: number, newPct: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };

  const record = await prisma.buyout.findUnique({ where: { id: buyoutId } });
  if (!record || record.totalCost !== 0) return { ok: false, error: "Retention record not found." };
  if (!record.playerId) return { ok: false, error: "This record has no linked player to recalculate against." };

  const settings = await loadSettings();
  if (!Number.isFinite(newPct) || newPct < 0) return { ok: false, error: "Enter a percentage of 0 or more." };
  if (newPct > settings.retentionMaxPct) return { ok: false, error: `Max allowed is ${settings.retentionMaxPct}%.` };

  const [player, siblings] = await Promise.all([
    prisma.player.findUnique({ where: { id: record.playerId }, select: { capHit: true } }),
    prisma.buyout.findMany({ where: { playerId: record.playerId, totalCost: 0 }, select: { id: true, perYear: true, startYear: true, years: true } }),
  ]);
  if (!player) return { ok: false, error: "Player not found." };

  const otherActiveTotal = siblings
    .filter((s) => s.id !== record.id && CURRENT_SEASON_START < s.startYear + s.years)
    .reduce((sum, s) => sum + s.perYear, 0);
  const netBefore = Math.max(0, (player.capHit ?? 0) - otherActiveTotal);
  const newPerYear = Math.round((netBefore * newPct / 100) / 500) * 500;
  const netCap = netBefore - newPerYear;
  if (netCap < settings.retentionMinSalary) return { ok: false, error: `That would drop his salary below the ${settings.retentionMinSalary.toLocaleString()} floor.` };

  await prisma.buyout.update({ where: { id: record.id }, data: { perYear: newPerYear } });
  await prisma.player.update({ where: { id: record.playerId }, data: { retainedSalary: otherActiveTotal + newPerYear } });

  revalidatePath("/admin/salary-retention");
  return { ok: true };
}
