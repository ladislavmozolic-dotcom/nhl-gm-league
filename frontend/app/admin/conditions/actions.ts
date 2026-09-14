"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { cleanName } from "@/lib/playerName";
import { evaluateCondition, OP_LABELS, type Metric, type Op } from "@/lib/trade-conditions-server";

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

/** Attach stat-threshold tracking to an existing (already-PENDING, plain
 *  free-text) condition, and lock both candidate picks so neither can be
 *  traded away elsewhere while the outcome is still unknown. */
export async function attachStructuredCondition(input: {
  conditionId: number; playerId: number; seasonYear: number;
  metric: Metric; op: Op; threshold: number;
  metric2?: Metric | ""; op2?: Op | ""; threshold2?: number | null; logic2?: "AND" | "OR" | "";
  pickAId: number; pickBId: number;
}) {
  if (!(await isAdmin())) return { ok: false as const, error: "Only the commissioner can attach tracking." };
  const condition = await prisma.tradeCondition.findUnique({ where: { id: input.conditionId } });
  if (!condition) return { ok: false as const, error: "Condition not found." };
  if (condition.status !== "PENDING") return { ok: false as const, error: "This condition is already resolved." };
  if (input.pickAId === input.pickBId) return { ok: false as const, error: "Pick A and Pick B must be different picks." };

  const picks = await prisma.draftPick.findMany({ where: { id: { in: [input.pickAId, input.pickBId] } } });
  if (picks.length !== 2) return { ok: false as const, error: "One of the picks wasn't found." };
  const alreadyLocked = picks.find((p) => p.lockedByConditionId != null);
  if (alreadyLocked) return { ok: false as const, error: `Pick ${alreadyLocked.year} R${alreadyLocked.round} is already locked by another condition.` };

  await prisma.$transaction([
    prisma.tradeCondition.update({
      where: { id: input.conditionId },
      data: {
        playerId: input.playerId, seasonYear: input.seasonYear,
        metric: input.metric, op: input.op, threshold: input.threshold,
        metric2: input.metric2 || null, op2: input.op2 || null, threshold2: input.threshold2 ?? null, logic2: input.logic2 || null,
        pickAId: input.pickAId, pickBId: input.pickBId,
      },
    }),
    prisma.draftPick.update({ where: { id: input.pickAId }, data: { lockedByConditionId: input.conditionId } }),
    prisma.draftPick.update({ where: { id: input.pickBId }, data: { lockedByConditionId: input.conditionId } }),
  ]);
  revalidatePath("/admin/conditions");
  return { ok: true as const };
}

/** Evaluate now and settle for good: on MET, swap pickB to toTeamId and pickA
 *  back to fromTeamId; on NOT MET, no asset moves (pickA was already the
 *  resting state). Either way both picks unlock and the condition closes. */
export async function resolveStructuredCondition(conditionId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Only the commissioner can resolve conditions." };
  const condition = await prisma.tradeCondition.findUnique({ where: { id: conditionId } });
  if (!condition) return { ok: false as const, error: "Condition not found." };
  if (condition.status !== "PENDING") return { ok: false as const, error: "Already resolved." };
  if (!condition.pickAId || !condition.pickBId) return { ok: false as const, error: "No structured tracking attached yet." };

  const evalResult = await evaluateCondition(condition);
  if (!evalResult) return { ok: false as const, error: "Missing player/season — can't evaluate." };

  const [player, fromTeam, toTeam, pickA, pickB] = await Promise.all([
    prisma.player.findUnique({ where: { id: condition.playerId! }, select: { name: true } }),
    prisma.team.findUnique({ where: { id: condition.fromTeamId }, select: { name: true } }),
    prisma.team.findUnique({ where: { id: condition.toTeamId }, select: { name: true } }),
    prisma.draftPick.findUnique({ where: { id: condition.pickAId } }),
    prisma.draftPick.findUnique({ where: { id: condition.pickBId } }),
  ]);
  const summary = evalResult.clauses
    .map((c) => `${c.label} ${OP_LABELS[c.op as Op] ?? c.op} ${c.threshold} (actual: ${c.value})${c.pass ? " ✓" : " ✗"}`)
    .join(condition.logic2 === "OR" ? " OR " : " AND ");

  const ops = [];
  let note: string;
  if (evalResult.met && pickA && pickB) {
    ops.push(prisma.draftPick.update({ where: { id: pickA.id }, data: { teamId: condition.fromTeamId, lockedByConditionId: null } }));
    ops.push(prisma.draftPick.update({ where: { id: pickB.id }, data: { teamId: condition.toTeamId, lockedByConditionId: null } }));
    note = `RESOLVED — condition MET (${summary}). ${toTeam?.name} gets the ${pickB.year} R${pickB.round} instead of the ${pickA.year} R${pickA.round} (returned to ${fromTeam?.name}).`;
    ops.push(prisma.transaction.create({ data: { type: "TRADE", message: `Conditional pick settled: ${player ? cleanName(player.name) : "player"} hit his target — ${fromTeam?.name} sends ${toTeam?.name} the ${pickB.year} R${pickB.round} instead of the ${pickA.year} R${pickA.round}.` } }));
  } else {
    if (pickA) ops.push(prisma.draftPick.update({ where: { id: pickA.id }, data: { lockedByConditionId: null } }));
    if (pickB) ops.push(prisma.draftPick.update({ where: { id: pickB.id }, data: { lockedByConditionId: null } }));
    note = `RESOLVED — condition NOT met (${summary}). Pick stays as-is (${pickA ? `${pickA.year} R${pickA.round}` : "?"}).`;
    ops.push(prisma.transaction.create({ data: { type: "TRADE", message: `Conditional pick settled: ${player ? cleanName(player.name) : "player"} didn't hit his target — the ${pickA ? `${pickA.year} R${pickA.round}` : ""} pick stays with ${toTeam?.name}.` } }));
  }
  ops.push(prisma.tradeCondition.update({ where: { id: conditionId }, data: { status: "FULFILLED", resolvedAt: new Date(), description: `${condition.description}\n\n${note}` } }));
  await prisma.$transaction(ops);
  revalidatePath("/admin/conditions");
  return { ok: true as const, met: evalResult.met };
}
