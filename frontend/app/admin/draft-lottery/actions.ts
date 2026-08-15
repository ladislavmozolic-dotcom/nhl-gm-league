"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { runLottery, simulateLottery, type LotteryOutcome } from "@/lib/draft-lottery";

export type LotteryResultRow = { pick: number; teamId: number; code: string; name: string; logo: string | null; viaLottery: boolean; combo: number[] | null };

async function withTeams(o: LotteryOutcome): Promise<LotteryResultRow[]> {
  const teams = await prisma.team.findMany({ where: { id: { in: o.round1.map((r) => r.teamId) } }, select: { id: true, code: true, name: true, logoUrl: true } });
  const t = new Map(teams.map((x) => [x.id, x]));
  return o.round1.map((r) => ({ pick: r.pick, teamId: r.teamId, code: t.get(r.teamId)?.code ?? "—", name: t.get(r.teamId)?.name ?? "—", logo: t.get(r.teamId)?.logoUrl ?? null, viaLottery: r.viaLottery, combo: r.combo }));
}

/** Draw the lottery for a draft year and persist the round-1 order (admin only). */
export async function runLotteryAction(year: number) {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  const r = await runLottery(year);
  revalidatePath("/draft/lottery");
  return { ok: true, winners: r.winners.length };
}

/** A non-committing practice draw — returns the round-1 order without storing it. */
export async function practiceLotteryAction(year: number): Promise<{ ok: boolean; order?: LotteryResultRow[] }> {
  const o = await simulateLottery(year);
  return { ok: true, order: await withTeams(o) };
}

/** Start the LIVE broadcast: draw + store the result and stamp startedAt so every
 *  GM's client reveals it in sync (offline GMs get the result + a replay). */
export async function startLotteryBroadcastAction(year: number) {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  await runLottery(year);
  await prisma.draftLotteryRun.upsert({ where: { year }, update: { startedAt: new Date(), status: "LIVE" }, create: { year, startedAt: new Date(), status: "LIVE" } });
  revalidatePath("/draft/lottery");
  return { ok: true };
}

/** Reset back to the pre-draw lobby (clears the run + stored order). */
export async function resetLotteryAction(year: number) {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  await prisma.$transaction([
    prisma.draftLotteryRun.deleteMany({ where: { year } }),
    prisma.draftLottery.deleteMany({ where: { year } }),
  ]);
  revalidatePath("/draft/lottery");
  return { ok: true };
}
