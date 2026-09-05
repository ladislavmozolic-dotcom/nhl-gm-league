"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin, isCommission } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { revalidatePath } from "next/cache";
import { clauseBlock, assertOwnership, createTradeRecord, executeTradeGroup, type TradePackage } from "@/lib/trade-exec";

/** One one-directional asset move: `fromTeamId`'s listed assets go to `toTeamId`.
 *  A 3-team trade is exactly 3 of these forming a closed cycle (A→C, B→A, C→B) —
 *  each of the 3 clubs sends to exactly one other club and receives from exactly
 *  one other club. `retentions` is playerId → % retained by fromTeamId (same
 *  rules as a 2-team trade — max/min %, the double-retention cap, the 75-day
 *  cooldown, all enforced by collectMoveOps per leg exactly as before).
 *  `clauseFees` covers a clause-protected player: the agent-set fee fromTeamId
 *  agrees to pay to waive it (recomputed and verified server-side, same as the
 *  2-team flow — a client can't waive one for free by lying about the amount). */
export type GroupLeg = {
  fromTeamId: number; toTeamId: number; playerIds: number[]; pickIds: number[]; prospectIds: number[]; cash: number;
  retentions?: Record<number, number>;
  clauseFees?: { playerId: number; feeAmount: number }[];
};

async function notifyCommissionGroup(body: string) {
  const comishTeams = await prisma.team.findMany({
    where: { OR: [{ isAdmin: true }, { gmRole: { in: ["comish", "co_comish", "trade_comish"] } }], passwordHash: { not: null } },
    select: { id: true },
  });
  for (const c of comishTeams)
    await prisma.dmMessage.create({ data: { fromTeamId: c.id, toTeamId: c.id, body, tradeUrl: "/trades" } }).catch(() => {});
}

export async function proposeTradeGroupAction(legs: GroupLeg[]) {
  const session = await getTeamSession();
  if (!session) throw new Error("Not logged in.");
  if (legs.length !== 3) throw new Error("A 3-team trade needs exactly 3 legs.");

  const teamIds = new Set<number>();
  for (const l of legs) { teamIds.add(l.fromTeamId); teamIds.add(l.toTeamId); }
  if (teamIds.size !== 3) throw new Error("A 3-team trade needs exactly 3 different clubs.");
  if (!teamIds.has(session)) throw new Error("You can only propose a trade your own team is part of.");

  // must form a proper closed cycle: each club sends exactly once, receives exactly once
  const fromCounts = new Map<number, number>(), toCounts = new Map<number, number>();
  for (const l of legs) {
    if (l.fromTeamId === l.toTeamId) throw new Error("A leg can't send a club's assets to itself.");
    fromCounts.set(l.fromTeamId, (fromCounts.get(l.fromTeamId) ?? 0) + 1);
    toCounts.set(l.toTeamId, (toCounts.get(l.toTeamId) ?? 0) + 1);
  }
  for (const id of teamIds) {
    if (fromCounts.get(id) !== 1 || toCounts.get(id) !== 1) throw new Error("Each of the 3 clubs must send to exactly one other club and receive from exactly one other club.");
  }
  const hasAnyAssets = legs.some((l) => l.playerIds.length || l.pickIds.length || l.prospectIds.length || l.cash);
  if (!hasAnyAssets) throw new Error("Add at least one asset somewhere in the deal.");

  const pkgs: TradePackage[] = legs.map((l) => ({
    fromTeamId: l.fromTeamId, toTeamId: l.toTeamId,
    fromPlayers: l.playerIds.map((id) => ({ playerId: id, retentionPct: l.retentions?.[id] ?? 0 })), toPlayers: [],
    fromPicks: l.pickIds, toPicks: [],
    fromProspects: l.prospectIds, toProspects: [],
    fromCash: l.cash, toCash: 0,
    condition: "",
    waived: (l.clauseFees ?? []).map((f) => f.playerId),
    clauseFees: (l.clauseFees ?? []).map((f) => ({ playerId: f.playerId, feeAmount: f.feeAmount, payTeamId: l.fromTeamId })),
  }));

  const settings = await loadSettings();
  const teamNames = new Map<number, string>();
  for (const pkg of pkgs) {
    const { fromTeam, toTeam } = await assertOwnership(pkg);
    teamNames.set(fromTeam.id, fromTeam.name); teamNames.set(toTeam.id, toTeam.name);
    if (settings.clausesEnabled && pkg.fromPlayers.length) {
      const cp = await prisma.player.findMany({ where: { id: { in: pkg.fromPlayers.map((p) => p.playerId) } }, select: { id: true, name: true, tradeClause: true, noTradeTeams: true } });
      const byId = new Map(cp.map((p) => [p.id, p]));
      const waived = new Set(pkg.waived ?? []);
      for (const p of pkg.fromPlayers) {
        const pl = byId.get(p.playerId);
        const b = pl && clauseBlock(pl, pkg.toTeamId, waived, true);
        if (b) throw new Error(b);
      }
      // A waived clause must actually be CONSENTED/PAID for — recompute the agent
      // fee server-side (same as the 2-team flow) so a crafted payload can't waive
      // one for free.
      const { clauseTerms } = await import("@/lib/clause-agent-server");
      const feeBy = new Map((pkg.clauseFees ?? []).map((f) => [f.playerId, f]));
      for (const p of pkg.fromPlayers) {
        const pl = byId.get(p.playerId);
        if (!pl?.tradeClause) continue;
        const blocks = pl.tradeClause === "M_NTC" ? (pl.noTradeTeams ?? []).includes(pkg.toTeamId) : true;
        if (!blocks) continue;
        const terms = await clauseTerms(p.playerId, pkg.toTeamId);
        const required = terms?.feeAmount ?? 0;
        if (required <= 0) continue;
        const paid = feeBy.get(p.playerId);
        if (!paid || paid.feeAmount < required || paid.payTeamId !== pkg.fromTeamId)
          throw new Error(`${pl.name} won't waive his clause for free — the agent fee is $${(required / 1e6).toFixed(2)}M, paid by the club dealing him.`);
      }
    }
  }

  const group = await prisma.tradeGroup.create({ data: { proposerTeamId: session, status: "PENDING" } });
  await prisma.tradeGroupResponse.createMany({
    data: [...teamIds].map((id) => ({ groupId: group.id, teamId: id, status: id === session ? "ACCEPTED" : "PENDING", respondedAt: id === session ? new Date() : null })),
  });
  for (const pkg of pkgs) {
    await createTradeRecord(pkg, { fromName: teamNames.get(pkg.fromTeamId) ?? "?", toName: teamNames.get(pkg.toTeamId) ?? "?", groupId: group.id, skipDm: true });
  }
  for (const teamId of teamIds) {
    if (teamId === session) continue;
    await prisma.dmMessage.create({
      data: { fromTeamId: session, toTeamId: teamId, body: `📩 ${teamNames.get(session)} proposed a 3-team trade (#${group.id}) involving your club — open Trades to review, then Accept or Decline.`, tradeUrl: "/trades" },
    }).catch(() => {});
  }
  revalidatePath("/trades"); revalidatePath("/trades/commish"); revalidatePath("/messages");
  return { groupId: group.id };
}

export async function respondToTradeGroupAction(groupId: number, accept: boolean) {
  const session = await getTeamSession();
  const admin = await isAdmin();
  if (!session && !admin) throw new Error("Not logged in.");
  const group = await prisma.tradeGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new Error("Trade group not found.");
  if (group.status !== "PENDING") throw new Error("This trade group is no longer pending.");

  const resp = session != null ? await prisma.tradeGroupResponse.findUnique({ where: { groupId_teamId: { groupId, teamId: session } } }) : null;
  if (!resp && !admin) throw new Error("Your club isn't part of this trade group.");
  if (resp && resp.status !== "PENDING" && !admin) throw new Error("You've already responded to this trade group.");

  const allResponses = await prisma.tradeGroupResponse.findMany({ where: { groupId } });
  const teams = await prisma.team.findMany({ where: { id: { in: allResponses.map((r) => r.teamId) } }, select: { id: true, name: true, rookieGm: true } });
  const nameOf = (id: number) => teams.find((t) => t.id === id)?.name ?? "?";

  if (!accept) {
    await prisma.$transaction([
      prisma.tradeGroup.update({ where: { id: groupId }, data: { status: "DECLINED", respondedAt: new Date() } }),
      prisma.trade.updateMany({ where: { groupId }, data: { status: "DECLINED", respondedAt: new Date() } }),
      ...(resp ? [prisma.tradeGroupResponse.update({ where: { id: resp.id }, data: { status: "DECLINED", respondedAt: new Date() } })] : []),
    ]);
    const declinerId = session ?? group.proposerTeamId;
    for (const t of teams) if (t.id !== declinerId) await prisma.dmMessage.create({ data: { fromTeamId: declinerId, toTeamId: t.id, body: `❌ ${nameOf(declinerId)} declined the 3-team trade (#${groupId}) — it's off.`, tradeUrl: "/trades" } }).catch(() => {});
    revalidatePath("/trades"); revalidatePath("/messages");
    return { status: "DECLINED" as const };
  }

  if (resp) await prisma.tradeGroupResponse.update({ where: { id: resp.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
  const refreshed = await prisma.tradeGroupResponse.findMany({ where: { groupId } });
  if (refreshed.some((r) => r.status === "PENDING")) {
    revalidatePath("/trades"); revalidatePath("/messages");
    return { status: "PENDING" as const };
  }

  if (teams.some((t) => t.rookieGm)) {
    await prisma.$transaction([
      prisma.tradeGroup.update({ where: { id: groupId }, data: { status: "AWAITING_COMMISH" } }),
      prisma.trade.updateMany({ where: { groupId }, data: { status: "AWAITING_COMMISH" } }),
    ]);
    await notifyCommissionGroup(`🕵️ 3-team trade group #${groupId} (${teams.map((t) => t.name).join(", ")}) — a rookie GM deal is awaiting commission review.`);
    revalidatePath("/trades"); revalidatePath("/trades/commish"); revalidatePath("/messages");
    return { status: "AWAITING_COMMISH" as const };
  }

  await executeTradeGroup(groupId);
  for (const t of teams) await prisma.dmMessage.create({ data: { fromTeamId: t.id, toTeamId: t.id, body: `✅ The 3-team trade (#${groupId}) is complete.`, tradeUrl: "/trades" } }).catch(() => {});
  revalidatePath("/trades"); revalidatePath("/salary-cap"); revalidatePath("/finance"); revalidatePath("/messages");
  return { status: "ACCEPTED" as const };
}

/** Commission reviews a rookie-involving 3-team group: accept (execute) or decline (kill). */
export async function commishRespondTradeGroupAction(groupId: number, action: "accept" | "decline") {
  if (!(await isCommission())) throw new Error("Only a commission member can review rookie trades.");
  const group = await prisma.tradeGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new Error("Trade group not found.");
  if (group.status !== "AWAITING_COMMISH") throw new Error("This trade group isn't awaiting commission review.");

  const actingTeamId = await getTeamSession();
  const responses = await prisma.tradeGroupResponse.findMany({ where: { groupId } });
  if (actingTeamId != null && responses.some((r) => r.teamId === actingTeamId)) {
    throw new Error("You're a club on this trade — a different Trade Comish member has to review it.");
  }
  const teams = await prisma.team.findMany({ where: { id: { in: responses.map((r) => r.teamId) } }, select: { id: true, name: true } });

  if (action === "decline") {
    await prisma.$transaction([
      prisma.tradeGroup.update({ where: { id: groupId }, data: { status: "DECLINED", respondedAt: new Date() } }),
      prisma.trade.updateMany({ where: { groupId }, data: { status: "DECLINED", respondedAt: new Date() } }),
    ]);
    for (const t of teams) await prisma.dmMessage.create({ data: { fromTeamId: t.id, toTeamId: t.id, body: `❌ The commission declined the 3-team trade (#${groupId}).`, tradeUrl: "/trades" } }).catch(() => {});
    revalidatePath("/trades"); revalidatePath("/trades/commish"); revalidatePath("/messages");
    return { status: "DECLINED" as const };
  }

  await executeTradeGroup(groupId);
  for (const t of teams) await prisma.dmMessage.create({ data: { fromTeamId: t.id, toTeamId: t.id, body: `✅ The commission approved the 3-team trade (#${groupId}) — it's done.`, tradeUrl: "/trades" } }).catch(() => {});
  revalidatePath("/trades"); revalidatePath("/trades/commish"); revalidatePath("/salary-cap"); revalidatePath("/finance"); revalidatePath("/messages");
  return { status: "ACCEPTED" as const };
}
