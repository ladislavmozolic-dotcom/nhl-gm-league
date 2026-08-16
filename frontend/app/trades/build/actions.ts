"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { revalidatePath } from "next/cache";

export type TradePlayer = { playerId: number; retentionPct: number };
export type TradePackage = {
  fromTeamId: number; toTeamId: number;
  fromPlayers: TradePlayer[]; toPlayers: TradePlayer[];
  fromPicks: number[]; toPicks: number[];
  fromProspects: number[]; toProspects: number[];
  fromCash: number; toCash: number;
  condition: string;
  waived?: number[]; // player ids whose NTC/NMC/M-NTC clause is waived for this deal
};

type ClausePlayer = { id: number; name: string; tradeClause: string | null; noTradeTeams: number[] };
/** A blocking reason if this player's clause forbids a move to `destTeamId`, else null. */
function clauseBlock(pl: ClausePlayer, destTeamId: number, waived: Set<number>, enabled: boolean): string | null {
  if (!enabled || !pl.tradeClause || waived.has(pl.id)) return null;
  if (pl.tradeClause === "M_NTC")
    return (pl.noTradeTeams ?? []).includes(destTeamId) ? `${pl.name} has a modified no-trade clause that blocks a deal to that team — he must waive it.` : null;
  return `${pl.name} has a ${pl.tradeClause === "NMC" ? "no-movement" : "no-trade"} clause — he must waive it to be dealt.`;
}

type OrgTeam = { id: number; name: string; bankAccount: number; affiliateTeams: { id: number }[] };

const orgIds = (t: OrgTeam) => [t.id, ...t.affiliateTeams.map((a) => a.id)];

/**
 * Build the prisma ops that actually execute a trade (move players/picks/
 * prospects, transfer cash, apply salary retention). Validates ownership and
 * retention rules — throws on any violation. Shared by accept-time execution.
 */
async function collectMoveOps(pkg: TradePackage) {
  const [fromTeam, toTeam, settings] = await Promise.all([
    prisma.team.findUnique({ where: { id: pkg.fromTeamId }, select: { id: true, name: true, bankAccount: true, affiliateTeams: { select: { id: true } } } }),
    prisma.team.findUnique({ where: { id: pkg.toTeamId }, select: { id: true, name: true, bankAccount: true, affiliateTeams: { select: { id: true } } } }),
    loadSettings(),
  ]);
  if (!fromTeam || !toTeam) throw new Error("Team not found");
  const fromAff = fromTeam.affiliateTeams[0]?.id ?? null;
  const toAff = toTeam.affiliateTeams[0]?.id ?? null;

  const allPlayerIds = [...pkg.fromPlayers, ...pkg.toPlayers].map((p) => p.playerId);
  const players = await prisma.player.findMany({
    where: { id: { in: allPlayerIds } },
    select: { id: true, name: true, teamId: true, rosterType: true, capHit: true, contractYears: true, tradeClause: true, noTradeTeams: true },
  });
  const pById = new Map(players.map((p) => [p.id, p]));
  const waived = new Set(pkg.waived ?? []);

  const maxPct = settings.retentionMaxPct;
  const retainedCount = [...pkg.fromPlayers, ...pkg.toPlayers].filter((p) => p.retentionPct > 0).length;
  if (retainedCount > settings.retentionMaxPlayers) throw new Error(`Max ${settings.retentionMaxPlayers} retained players per trade.`);

  const ops: Promise<unknown>[] = [];
  const retentionRecords: Array<{ teamId: number; playerName: string; perYear: number; years: number }> = [];

  const movePlayers = (list: TradePlayer[], fromOrg: OrgTeam, toNhlId: number, toAffId: number | null) => {
    const fromOrgIds = orgIds(fromOrg);
    for (const tp of list) {
      const pl = pById.get(tp.playerId);
      if (!pl || !fromOrgIds.includes(pl.teamId ?? -1)) throw new Error("A player is no longer on the expected team.");
      const block = clauseBlock(pl, toNhlId, waived, settings.clausesEnabled);
      if (block) throw new Error(block);
      const toFarm = pl.rosterType === "AHL";
      const destId = toFarm ? (toAffId ?? toNhlId) : toNhlId;
      const destRoster = toFarm && toAffId ? "AHL" : "NHL";
      let capHit = pl.capHit ?? 0;
      if (tp.retentionPct > 0 && capHit) {
        const pct = Math.min(maxPct, tp.retentionPct);
        const retained = Math.round((capHit * pct / 100) / 100000) * 100000;
        const newCap = capHit - retained;
        if (newCap < settings.retentionMinSalary) throw new Error(`Retention would drop ${pl.name} below the ${settings.retentionMinSalary.toLocaleString()} floor.`);
        capHit = newCap;
        retentionRecords.push({ teamId: fromOrg.id, playerName: `${pl.name} (retained)`, perYear: retained, years: Math.max(1, pl.contractYears ?? 1) });
      }
      ops.push(prisma.player.update({ where: { id: pl.id }, data: { teamId: destId, rosterType: destRoster, capHit, captaincy: null } }));
    }
  };
  movePlayers(pkg.fromPlayers, fromTeam, pkg.toTeamId, toAff);
  movePlayers(pkg.toPlayers, toTeam, pkg.fromTeamId, fromAff);

  for (const id of pkg.fromPicks) ops.push(prisma.draftPick.update({ where: { id }, data: { teamId: pkg.toTeamId } }));
  for (const id of pkg.toPicks) ops.push(prisma.draftPick.update({ where: { id }, data: { teamId: pkg.fromTeamId } }));
  for (const id of pkg.fromProspects ?? []) ops.push(prisma.prospect.update({ where: { id }, data: { teamId: pkg.toTeamId } }));
  for (const id of pkg.toProspects ?? []) ops.push(prisma.prospect.update({ where: { id }, data: { teamId: pkg.fromTeamId } }));

  const net = (pkg.fromCash || 0) - (pkg.toCash || 0); // from pays net to `to`
  if (net !== 0) {
    // hit both bankAccount (live display) and ledgerAdj (survives processFinances recompute)
    ops.push(prisma.team.update({ where: { id: pkg.fromTeamId }, data: { bankAccount: { decrement: net }, ledgerAdj: { decrement: net } } }));
    ops.push(prisma.team.update({ where: { id: pkg.toTeamId }, data: { bankAccount: { increment: net }, ledgerAdj: { increment: net } } }));
  }

  for (const r of retentionRecords)
    ops.push(prisma.buyout.create({ data: { teamId: r.teamId, playerName: r.playerName, perYear: r.perYear, years: r.years, startYear: CURRENT_SEASON_START, totalCost: 0, inSeason: true } }));

  const fromNames = pkg.fromPlayers.map((p) => pById.get(p.playerId)?.name).filter(Boolean);
  const toNames = pkg.toPlayers.map((p) => pById.get(p.playerId)?.name).filter(Boolean);
  return { ops, fromTeam, toTeam, fromNames, toNames };
}

/** Verify the session GM owns every asset on the `from` side they're offering. */
async function assertOwnership(pkg: TradePackage) {
  const [fromTeam, toTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: pkg.fromTeamId }, select: { id: true, name: true, bankAccount: true, affiliateTeams: { select: { id: true } } } }),
    prisma.team.findUnique({ where: { id: pkg.toTeamId }, select: { id: true, name: true, bankAccount: true, affiliateTeams: { select: { id: true } } } }),
  ]);
  if (!fromTeam || !toTeam) throw new Error("Team not found");
  const fromOrg = orgIds(fromTeam), toOrg = orgIds(toTeam);

  const players = await prisma.player.findMany({ where: { id: { in: [...pkg.fromPlayers, ...pkg.toPlayers].map((p) => p.playerId) } }, select: { id: true, teamId: true } });
  for (const p of pkg.fromPlayers) { const pl = players.find((x) => x.id === p.playerId); if (!pl || !fromOrg.includes(pl.teamId ?? -1)) throw new Error("A player you offered is not on your team."); }
  for (const p of pkg.toPlayers) { const pl = players.find((x) => x.id === p.playerId); if (!pl || !toOrg.includes(pl.teamId ?? -1)) throw new Error("A requested player is not on the other team."); }
  return { fromTeam, toTeam };
}

/**
 * GM A proposes a trade. Nothing moves yet — a PENDING Trade + its TradeAssets
 * are stored, and GM B must accept before it executes.
 */
export async function proposeTrade(pkg: TradePackage) {
  const session = await getTeamSession();
  if (session !== pkg.fromTeamId) throw new Error("You can only propose trades as your own team.");
  if (pkg.fromTeamId === pkg.toTeamId) throw new Error("Pick a different team.");
  const hasAssets = pkg.fromPlayers.length || pkg.toPlayers.length || pkg.fromPicks.length || pkg.toPicks.length || (pkg.fromProspects?.length ?? 0) || (pkg.toProspects?.length ?? 0) || pkg.fromCash || pkg.toCash;
  if (!hasAssets) throw new Error("Add at least one asset.");

  const { fromTeam, toTeam } = await assertOwnership(pkg);

  // NTC / NMC / M-NTC: a protected player can't be moved unless his clause is waived.
  const settings = await loadSettings();
  if (settings.clausesEnabled) {
    const cp = await prisma.player.findMany({ where: { id: { in: [...pkg.fromPlayers, ...pkg.toPlayers].map((p) => p.playerId) } }, select: { id: true, name: true, tradeClause: true, noTradeTeams: true } });
    const byId = new Map(cp.map((p) => [p.id, p]));
    const waived = new Set(pkg.waived ?? []);
    for (const p of pkg.fromPlayers) { const pl = byId.get(p.playerId); const b = pl && clauseBlock(pl, pkg.toTeamId, waived, true); if (b) throw new Error(b); }
    for (const p of pkg.toPlayers) { const pl = byId.get(p.playerId); const b = pl && clauseBlock(pl, pkg.fromTeamId, waived, true); if (b) throw new Error(b); }
  }

  const trade = await prisma.trade.create({ data: { fromTeamId: pkg.fromTeamId, toTeamId: pkg.toTeamId, status: "PENDING", condition: pkg.condition || null, waivedClauses: pkg.waived ?? [] } });
  const rows: Array<{ tradeId: number; assetType: string; side: string; playerId?: number; prospectId?: number; draftPickId?: number; cashAmount?: number; retentionPct?: number }> = [];
  for (const p of pkg.fromPlayers) rows.push({ tradeId: trade.id, assetType: "PLAYER", side: "FROM", playerId: p.playerId, retentionPct: p.retentionPct || undefined });
  for (const p of pkg.toPlayers) rows.push({ tradeId: trade.id, assetType: "PLAYER", side: "TO", playerId: p.playerId, retentionPct: p.retentionPct || undefined });
  for (const id of pkg.fromProspects ?? []) rows.push({ tradeId: trade.id, assetType: "PROSPECT", side: "FROM", prospectId: id });
  for (const id of pkg.toProspects ?? []) rows.push({ tradeId: trade.id, assetType: "PROSPECT", side: "TO", prospectId: id });
  for (const id of pkg.fromPicks) rows.push({ tradeId: trade.id, assetType: "PICK", side: "FROM", draftPickId: id });
  for (const id of pkg.toPicks) rows.push({ tradeId: trade.id, assetType: "PICK", side: "TO", draftPickId: id });
  if (pkg.fromCash) rows.push({ tradeId: trade.id, assetType: "CASH", side: "FROM", cashAmount: pkg.fromCash });
  if (pkg.toCash) rows.push({ tradeId: trade.id, assetType: "CASH", side: "TO", cashAmount: pkg.toCash });

  await prisma.tradeAsset.createMany({ data: rows });
  if (pkg.condition?.trim())
    await prisma.tradeCondition.create({ data: { tradeId: trade.id, fromTeamId: pkg.fromTeamId, toTeamId: pkg.toTeamId, description: pkg.condition.trim(), status: "PENDING" } });
  await prisma.transaction.create({ data: { type: "TRADE", message: `${fromTeam.name} proposed a trade to ${toTeam.name}. Awaiting response.` } });
  revalidatePath("/trades");
  return { tradeId: trade.id };
}

/** Rebuild the TradePackage from stored TradeAssets. */
async function packageFromTrade(tradeId: number): Promise<TradePackage> {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found");
  const assets = await prisma.tradeAsset.findMany({ where: { tradeId } });
  const pkg: TradePackage = {
    fromTeamId: trade.fromTeamId, toTeamId: trade.toTeamId,
    fromPlayers: [], toPlayers: [], fromPicks: [], toPicks: [], fromProspects: [], toProspects: [],
    fromCash: 0, toCash: 0, condition: trade.condition ?? "",
  };
  for (const a of assets) {
    const from = a.side === "FROM";
    if (a.assetType === "PLAYER" && a.playerId) (from ? pkg.fromPlayers : pkg.toPlayers).push({ playerId: a.playerId, retentionPct: a.retentionPct ?? 0 });
    else if (a.assetType === "PROSPECT" && a.prospectId) (from ? pkg.fromProspects : pkg.toProspects).push(a.prospectId);
    else if (a.assetType === "PICK" && a.draftPickId) (from ? pkg.fromPicks : pkg.toPicks).push(a.draftPickId);
    else if (a.assetType === "CASH" && a.cashAmount) { if (from) pkg.fromCash = a.cashAmount; else pkg.toCash = a.cashAmount; }
  }
  return pkg;
}

/** GM B accepts or declines a pending trade. Accepting executes the moves. */
export async function respondToTrade(tradeId: number, accept: boolean) {
  const session = await getTeamSession();
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found");
  if (trade.status !== "PENDING") throw new Error("This trade is no longer pending.");
  if (session !== trade.toTeamId) throw new Error("Only the receiving GM can respond to this trade.");

  if (!accept) {
    await prisma.trade.update({ where: { id: tradeId }, data: { status: "DECLINED", respondedAt: new Date() } });
    await prisma.transaction.create({ data: { type: "TRADE", message: `Trade #${tradeId} was declined.` } });
    revalidatePath("/trades");
    return { status: "DECLINED" as const };
  }

  const pkg = await packageFromTrade(tradeId);
  pkg.waived = trade.waivedClauses ?? []; // carry the waivers agreed at proposal time
  const { ops, fromTeam, toTeam, fromNames, toNames } = await collectMoveOps(pkg);
  ops.push(prisma.trade.update({ where: { id: tradeId }, data: { status: "ACCEPTED", respondedAt: new Date() } }));
  ops.push(prisma.transaction.create({
    data: { type: "TRADE", message: `${fromTeam.name} traded ${fromNames.join(", ") || "assets"} to ${toTeam.name} for ${toNames.join(", ") || "assets"}.` },
  }));
  await prisma.$transaction(ops);
  revalidatePath("/trades"); revalidatePath("/salary-cap"); revalidatePath("/finance");
  return { status: "ACCEPTED" as const };
}

/** Commissioner deletes a trade entirely (and its assets/conditions). For clearing
 *  spam, duplicates, or a mistaken proposal. Does NOT reverse an already-applied
 *  ACCEPTED trade's roster moves — it only removes the record. */
export async function deleteTradeAction(tradeId: number) {
  if (!(await isAdmin())) throw new Error("Only the commissioner can delete trades.");
  const trade = await prisma.trade.findUnique({ where: { id: tradeId }, select: { id: true, status: true } });
  if (!trade) throw new Error("Trade not found.");
  await prisma.$transaction([
    prisma.tradeAsset.deleteMany({ where: { tradeId } }),
    prisma.tradeCondition.deleteMany({ where: { tradeId } }),
    prisma.trade.delete({ where: { id: tradeId } }),
  ]);
  revalidatePath("/trades");
  return { ok: true, wasStatus: trade.status };
}

/** GM A cancels their own still-pending proposal. */
export async function cancelTrade(tradeId: number) {
  const session = await getTeamSession();
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found");
  if (trade.status !== "PENDING") throw new Error("This trade is no longer pending.");
  if (session !== trade.fromTeamId) throw new Error("Only the proposing GM can cancel this trade.");
  await prisma.trade.update({ where: { id: tradeId }, data: { status: "CANCELLED", respondedAt: new Date() } });
  revalidatePath("/trades");
  return { status: "CANCELLED" as const };
}
