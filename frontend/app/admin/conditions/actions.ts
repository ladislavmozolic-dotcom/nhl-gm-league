"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { cleanName } from "@/lib/playerName";
import { evaluateCondition, type ConditionEval, type StructuredCondition, type Metric, type Op, type ConditionClause } from "@/lib/trade-conditions-server";
import type { Prisma } from "@prisma/client";

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
 *  traded away elsewhere while the outcome is still unknown. Real-NHL-stat
 *  clauses only — the fuller clause picker (UNHL stats, playoff round,
 *  contract extension, lottery protection) lives in the Trade Builder itself. */
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
  // structured tracking is judged against the player's REAL NHL production, so
  // a fictional/generated player with no real nhlId on file can't be tracked
  const trackedPlayer = await prisma.player.findUnique({ where: { id: input.playerId }, select: { nhlId: true } });
  if (!trackedPlayer?.nhlId) return { ok: false as const, error: "This player has no real NHL ID on file — his real-life production can't be tracked." };

  const picks = await prisma.draftPick.findMany({ where: { id: { in: [input.pickAId, input.pickBId] } } });
  if (picks.length !== 2) return { ok: false as const, error: "One of the picks wasn't found." };
  const alreadyLocked = picks.find((p) => p.lockedByConditionId != null);
  if (alreadyLocked) return { ok: false as const, error: `Pick ${alreadyLocked.year} R${alreadyLocked.round} is already locked by another condition.` };

  const clauses: ConditionClause[] = [{ kind: "STAT", source: "REAL_NHL", seasonYear: input.seasonYear, metric: input.metric, op: input.op, threshold: input.threshold }];
  if (input.metric2 && input.op2 && input.threshold2 != null) {
    clauses.push({ kind: "STAT", source: "REAL_NHL", seasonYear: input.seasonYear, metric: input.metric2, op: input.op2, threshold: input.threshold2, logic: input.logic2 || "AND" });
  }

  await prisma.$transaction([
    prisma.tradeCondition.update({
      where: { id: input.conditionId },
      data: {
        playerId: input.playerId,
        clauses: clauses as unknown as Prisma.InputJsonValue,
        pickAId: input.pickAId, pickBId: input.pickBId,
      },
    }),
    prisma.draftPick.update({ where: { id: input.pickAId }, data: { lockedByConditionId: input.conditionId } }),
    prisma.draftPick.update({ where: { id: input.pickBId }, data: { lockedByConditionId: input.conditionId } }),
  ]);
  revalidatePath("/admin/conditions");
  return { ok: true as const };
}

/** Settle a condition that has already been evaluated: on MET, swap pickA
 *  (the upgrade) to toTeamId and pickB (the default, already resting with
 *  toTeamId) back to fromTeamId; on NOT MET, no asset moves (pickB was
 *  already the resting state). Either way both picks unlock and the
 *  condition closes. Shared by the admin "Resolve" button and the automatic
 *  post-draft-lottery hook (lib/draft-lottery.ts). */
export async function settleCondition(condition: StructuredCondition, evalResult: ConditionEval) {
  if (!condition.pickAId || !condition.pickBId) return;
  const [player, fromTeam, toTeam, pickA, pickB] = await Promise.all([
    condition.playerId != null ? prisma.player.findUnique({ where: { id: condition.playerId }, select: { name: true } }) : Promise.resolve(null),
    prisma.team.findUnique({ where: { id: condition.fromTeamId }, select: { name: true } }),
    prisma.team.findUnique({ where: { id: condition.toTeamId }, select: { name: true } }),
    prisma.draftPick.findUnique({ where: { id: condition.pickAId } }),
    prisma.draftPick.findUnique({ where: { id: condition.pickBId } }),
  ]);
  const summary = evalResult.clauses
    .map((c, i) => `${i === 0 ? "" : c.logic === "OR" ? "OR " : "AND "}${c.label} — ${c.detail}${c.pass ? " ✓" : " ✗"}`)
    .join(" ");
  const who = player ? cleanName(player.name) : "the tracked player";

  const ops = [];
  let note: string;
  if (evalResult.met && pickA && pickB) {
    ops.push(prisma.draftPick.update({ where: { id: pickB.id }, data: { teamId: condition.fromTeamId, lockedByConditionId: null } }));
    ops.push(prisma.draftPick.update({ where: { id: pickA.id }, data: { teamId: condition.toTeamId, lockedByConditionId: null } }));
    note = `RESOLVED — condition MET (${summary}). ${toTeam?.name} gets the ${pickA.year} R${pickA.round} instead of the ${pickB.year} R${pickB.round} (returned to ${fromTeam?.name}).`;
    ops.push(prisma.transaction.create({ data: { type: "TRADE", message: `Conditional pick settled: ${who} hit the target — ${fromTeam?.name} sends ${toTeam?.name} the ${pickA.year} R${pickA.round} instead of the ${pickB.year} R${pickB.round}.` } }));
  } else {
    if (pickA) ops.push(prisma.draftPick.update({ where: { id: pickA.id }, data: { lockedByConditionId: null } }));
    if (pickB) ops.push(prisma.draftPick.update({ where: { id: pickB.id }, data: { lockedByConditionId: null } }));
    note = `RESOLVED — condition NOT met (${summary}). Pick stays as-is (${pickB ? `${pickB.year} R${pickB.round}` : "?"}).`;
    ops.push(prisma.transaction.create({ data: { type: "TRADE", message: `Conditional pick settled: ${who} didn't hit the target — the ${pickB ? `${pickB.year} R${pickB.round}` : ""} pick stays with ${toTeam?.name}.` } }));
  }
  ops.push(prisma.tradeCondition.update({ where: { id: condition.id }, data: { status: "FULFILLED", resolvedAt: new Date(), description: `${condition.description}\n\n${note}` } }));
  await prisma.$transaction(ops);
}

/** Evaluate a PENDING condition right now and, if resolvable, settle it for
 *  good via settleCondition. */
export async function resolveStructuredCondition(conditionId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Only the commissioner can resolve conditions." };
  const condition = await prisma.tradeCondition.findUnique({ where: { id: conditionId } });
  if (!condition) return { ok: false as const, error: "Condition not found." };
  if (condition.status !== "PENDING") return { ok: false as const, error: "Already resolved." };
  if (!condition.pickAId || !condition.pickBId) return { ok: false as const, error: "No structured tracking attached yet." };

  const { eval: evalResult, error: evalError } = await evaluateCondition(condition);
  if (!evalResult) return { ok: false as const, error: evalError ?? "Couldn't evaluate this condition." };

  await settleCondition(condition, evalResult);
  revalidatePath("/admin/conditions");
  return { ok: true as const, met: evalResult.met };
}
