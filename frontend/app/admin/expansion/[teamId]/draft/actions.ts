"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { expansionPickOrder, exposedPlayersFor } from "@/lib/expansion-server";
import { revalidatePath } from "next/cache";

/** Admin-only: opens the actual draft once every existing club has submitted a
 *  protection list — freezes the (reverse-standings) pick order and flips SETUP → LIVE. */
export async function startExpansionDraftAction(expansionTeamId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const draft = await prisma.expansionDraftState.findUnique({ where: { teamId: expansionTeamId } });
  if (!draft) return { ok: false as const, error: "No expansion draft for that team." };
  if (draft.status !== "SETUP") return { ok: false as const, error: "The draft has already started." };

  const others = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false, NOT: { id: expansionTeamId } }, select: { id: true } });
  const submitted = await prisma.expansionProtection.count({ where: { expansionDraftId: draft.id, teamId: { in: others.map((t) => t.id) } } });
  if (submitted < others.length) return { ok: false as const, error: `${others.length - submitted} club(s) still haven't submitted a protection list.` };

  const order = await expansionPickOrder(expansionTeamId);
  await prisma.expansionDraftState.update({ where: { teamId: expansionTeamId }, data: { pickOrder: order, currentIdx: 0, status: "LIVE" } });
  revalidatePath(`/admin/expansion/${expansionTeamId}/draft`);
  return { ok: true as const };
}

/** Admin-only: the expansion team selects `playerId` off the club currently on the
 *  clock. Re-derives eligibility fresh (never trusts stored/client state), guards the
 *  advance atomically against a concurrent double-pick, and moves the player inside
 *  one transaction along with the structured pick record + transactions-log entry. */
export async function makeExpansionPickAction(expansionTeamId: number, playerId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const draft = await prisma.expansionDraftState.findUnique({ where: { teamId: expansionTeamId } });
  if (!draft) return { ok: false as const, error: "No expansion draft for that team." };
  if (draft.status !== "LIVE") return { ok: false as const, error: "The draft isn't live." };

  const sourceTeamId = draft.pickOrder[draft.currentIdx];
  if (sourceTeamId == null) return { ok: false as const, error: "Draft is complete." };

  const [player, sourceTeam, expTeam] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, select: { id: true, teamId: true, rosterType: true, name: true } }),
    prisma.team.findUnique({ where: { id: sourceTeamId }, select: { code: true, name: true } }),
    prisma.team.findUnique({ where: { id: expansionTeamId }, select: { code: true, name: true } }),
  ]);
  if (!player || player.teamId !== sourceTeamId || player.rosterType !== "NHL") return { ok: false as const, error: "That player isn't on the clock club's roster." };

  const exposed = await exposedPlayersFor(sourceTeamId, draft.id);
  if (!exposed.some((p) => p.id === playerId)) return { ok: false as const, error: "That player is protected — not available." };

  const nextIdx = draft.currentIdx + 1;
  const done = nextIdx >= draft.pickOrder.length;

  const res = await prisma.$transaction(async (tx) => {
    const upd = await tx.expansionDraftState.updateMany({
      where: { teamId: expansionTeamId, currentIdx: draft.currentIdx, status: "LIVE" },
      data: { currentIdx: nextIdx, status: done ? "DONE" : "LIVE" },
    });
    if (upd.count === 0) return { ok: false as const, error: "That pick was just made — refresh." };

    const moved = await tx.player.updateMany({ where: { id: playerId, teamId: sourceTeamId }, data: { teamId: expansionTeamId, rosterType: "NHL", captaincy: null, onBlock: false, blockNote: null } });
    if (moved.count === 0) return { ok: false as const, error: "That player was just moved — refresh." };

    await tx.expansionPick.create({ data: { expansionDraftId: draft.id, fromTeamId: sourceTeamId, toTeamId: expansionTeamId, playerId, pickNumber: draft.currentIdx + 1 } });
    await tx.transaction.create({ data: { type: "EXPANSION_DRAFT", teamId: expansionTeamId, playerId, message: `${expTeam?.code ?? "The expansion club"} selected ${player.name} from ${sourceTeam?.code ?? "a club"} in the expansion draft.` } });
    return { ok: true as const };
  });
  if (!res.ok) return res;
  revalidatePath(`/admin/expansion/${expansionTeamId}/draft`);
  revalidatePath(`/admin/expansion/${expansionTeamId}/results`);
  return { ok: true as const, done };
}

/** Admin-only escape hatch: reverses the most recent pick (player back to his original
 *  club, clock steps back one slot). Lets the commissioner correct a mistake without
 *  restarting the whole draft. */
export async function undoLastExpansionPickAction(expansionTeamId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const draft = await prisma.expansionDraftState.findUnique({ where: { teamId: expansionTeamId } });
  if (!draft) return { ok: false as const, error: "No expansion draft for that team." };
  if (draft.status === "SETUP") return { ok: false as const, error: "No picks to undo." };

  const last = await prisma.expansionPick.findFirst({ where: { expansionDraftId: draft.id }, orderBy: { pickNumber: "desc" } });
  if (!last) return { ok: false as const, error: "No picks to undo." };

  await prisma.$transaction(async (tx) => {
    await tx.player.updateMany({ where: { id: last.playerId, teamId: expansionTeamId }, data: { teamId: last.fromTeamId } });
    await tx.expansionPick.delete({ where: { id: last.id } });
    await tx.expansionDraftState.update({ where: { teamId: expansionTeamId }, data: { currentIdx: last.pickNumber - 1, status: "LIVE" } });
    await tx.transaction.create({ data: { type: "EXPANSION_DRAFT", teamId: expansionTeamId, playerId: last.playerId, message: `Expansion pick #${last.pickNumber} was undone by the commissioner — the player returned to his original club.` } });
  });
  revalidatePath(`/admin/expansion/${expansionTeamId}/draft`);
  revalidatePath(`/admin/expansion/${expansionTeamId}/results`);
  return { ok: true as const };
}
