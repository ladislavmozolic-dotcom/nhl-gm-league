// Shared trade primitives — the ownership/clause guards and the asset-mover that
// actually executes a deal. Lives in a plain module (NOT "use server") so both the
// human-facing server actions (app/trades/build/actions.ts) and the Advanced AI GM
// can call the SAME validated executor. Nothing here is a server action, so none of
// it is remotely invokable by a client — the auth checks stay in the action layer.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { CURRENT_SEASON_START } from "@/lib/finance";

export type TradePlayer = { playerId: number; retentionPct: number };
export type TradePackage = {
  fromTeamId: number; toTeamId: number;
  fromPlayers: TradePlayer[]; toPlayers: TradePlayer[];
  fromPicks: number[]; toPicks: number[];
  fromProspects: number[]; toProspects: number[];
  fromCash: number; toCash: number;
  condition: string;
  waived?: number[];
  clauseFees?: { playerId: number; feeAmount: number; payTeamId: number }[];
};

type ClausePlayer = { id: number; name: string; tradeClause: string | null; noTradeTeams: number[] };
/** A blocking reason if this player's clause forbids a move to `destTeamId`, else null. */
export function clauseBlock(pl: ClausePlayer, destTeamId: number, waived: Set<number>, enabled: boolean): string | null {
  if (!enabled || !pl.tradeClause || waived.has(pl.id)) return null;
  if (pl.tradeClause === "M_NTC")
    return (pl.noTradeTeams ?? []).includes(destTeamId) ? `${pl.name} has a modified no-trade clause that blocks a deal to that team — he must waive it.` : null;
  return `${pl.name} has a ${pl.tradeClause === "NMC" ? "no-movement" : "no-trade"} clause — he must waive it to be dealt.`;
}

type OrgTeam = { id: number; name: string; bankAccount: number; affiliateTeams: { id: number }[] };
export const orgIds = (t: OrgTeam) => [t.id, ...t.affiliateTeams.map((a) => a.id)];

/**
 * Build the prisma ops that actually execute a trade (move players/picks/
 * prospects, transfer cash, apply salary retention). Validates ownership and
 * retention rules — throws on any violation. Shared by accept-time execution.
 */
export async function collectMoveOps(pkg: TradePackage) {
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
    select: { id: true, name: true, teamId: true, rosterType: true, capHit: true, retainedSalary: true, contractYears: true, tradeClause: true, noTradeTeams: true },
  });
  const pById = new Map(players.map((p) => [p.id, p]));
  const waived = new Set([...(pkg.waived ?? []), ...(pkg.clauseFees ?? []).map((f) => f.playerId)]);

  const maxPct = settings.retentionMaxPct;
  const retainedCount = [...pkg.fromPlayers, ...pkg.toPlayers].filter((p) => p.retentionPct > 0).length;
  if (retainedCount > settings.retentionMaxPlayers) throw new Error(`Max ${settings.retentionMaxPlayers} retained players per trade.`);

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const retentionRecords: Array<{ teamId: number; playerId: number; playerName: string; perYear: number; years: number }> = [];

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
      // capHit is the player's own TRUE salary and never changes because of who's
      // paying part of it — retention is tracked separately (retainedSalary, the
      // slice a former club keeps carrying) so his profile/contract always reads
      // right, and the acquiring club's cap total nets it out at the team level
      // (see lib/cap.ts teamCapCommitted).
      const capHit = pl.capHit ?? 0;
      let retainedSalary = pl.retainedSalary ?? 0;
      if (tp.retentionPct > 0 && capHit) {
        const pct = Math.min(maxPct, tp.retentionPct);
        const retained = Math.round((capHit * pct / 100) / 50000) * 50000;
        const netCap = capHit - retained;
        if (netCap < settings.retentionMinSalary) throw new Error(`Retention would drop ${pl.name} below the ${settings.retentionMinSalary.toLocaleString()} floor.`);
        retainedSalary = retained;
        retentionRecords.push({ teamId: fromOrg.id, playerId: pl.id, playerName: `${pl.name} (retained)`, perYear: retained, years: Math.max(1, pl.contractYears ?? 1) });
      }
      // being shopped was the OLD club's decision — it doesn't carry over to whoever
      // just acquired him, so clear the trade-block flag on every trade.
      ops.push(prisma.player.update({ where: { id: pl.id }, data: { teamId: destId, rosterType: destRoster, capHit, retainedSalary, captaincy: null, onBlock: false, blockNote: null } }));
    }
  };
  movePlayers(pkg.fromPlayers, fromTeam, pkg.toTeamId, toAff);
  movePlayers(pkg.toPlayers, toTeam, pkg.fromTeamId, fromAff);

  const fromOrgIds = orgIds(fromTeam), toOrgIds = orgIds(toTeam);
  const allPickIds = [...pkg.fromPicks, ...pkg.toPicks];
  if (allPickIds.length) {
    const picks = await prisma.draftPick.findMany({ where: { id: { in: allPickIds } }, select: { id: true, teamId: true } });
    const pkById = new Map(picks.map((p) => [p.id, p]));
    for (const id of pkg.fromPicks) { const pk = pkById.get(id); if (!pk || !fromOrgIds.includes(pk.teamId)) throw new Error("A draft pick in this trade is no longer owned by the offering team."); }
    for (const id of pkg.toPicks) { const pk = pkById.get(id); if (!pk || !toOrgIds.includes(pk.teamId)) throw new Error("A requested draft pick is no longer owned by the other team."); }
  }
  const allProspectIds = [...(pkg.fromProspects ?? []), ...(pkg.toProspects ?? [])];
  if (allProspectIds.length) {
    const pros = await prisma.prospect.findMany({ where: { id: { in: allProspectIds } }, select: { id: true, teamId: true } });
    const prById = new Map(pros.map((p) => [p.id, p]));
    for (const id of pkg.fromProspects ?? []) { const pr = prById.get(id); if (!pr || !fromOrgIds.includes(pr.teamId)) throw new Error("A prospect in this trade is no longer owned by the offering team."); }
    for (const id of pkg.toProspects ?? []) { const pr = prById.get(id); if (!pr || !toOrgIds.includes(pr.teamId)) throw new Error("A requested prospect is no longer owned by the other team."); }
  }

  for (const id of pkg.fromPicks) ops.push(prisma.draftPick.update({ where: { id }, data: { teamId: pkg.toTeamId } }));
  for (const id of pkg.toPicks) ops.push(prisma.draftPick.update({ where: { id }, data: { teamId: pkg.fromTeamId } }));
  for (const id of pkg.fromProspects ?? []) ops.push(prisma.prospect.update({ where: { id }, data: { teamId: pkg.toTeamId } }));
  for (const id of pkg.toProspects ?? []) ops.push(prisma.prospect.update({ where: { id }, data: { teamId: pkg.fromTeamId } }));

  const net = (pkg.fromCash || 0) - (pkg.toCash || 0);
  if (net !== 0) {
    ops.push(prisma.team.update({ where: { id: pkg.fromTeamId }, data: { bankAccount: { decrement: net }, ledgerAdj: { decrement: net } } }));
    ops.push(prisma.team.update({ where: { id: pkg.toTeamId }, data: { bankAccount: { increment: net }, ledgerAdj: { increment: net } } }));
  }

  for (const r of retentionRecords)
    ops.push(prisma.buyout.create({ data: { teamId: r.teamId, playerId: r.playerId, playerName: r.playerName, perYear: r.perYear, years: r.years, startYear: CURRENT_SEASON_START, totalCost: 0, inSeason: true } }));

  for (const f of pkg.clauseFees ?? []) {
    if (!f.feeAmount) continue;
    const pl = pById.get(f.playerId);
    ops.push(prisma.team.update({ where: { id: f.payTeamId }, data: { bankAccount: { decrement: f.feeAmount }, ledgerAdj: { decrement: f.feeAmount } } }));
    ops.push(prisma.transaction.create({ data: { type: "CLAUSE_WAIVER", message: `Paid ${pl?.name ?? "a player"} ${(f.feeAmount / 1_000_000).toFixed(2)}M to waive his no-trade clause.` } }));
  }

  const fromNames = pkg.fromPlayers.map((p) => pById.get(p.playerId)?.name).filter(Boolean) as string[];
  const toNames = pkg.toPlayers.map((p) => pById.get(p.playerId)?.name).filter(Boolean) as string[];
  return { ops, fromTeam, toTeam, fromNames, toNames };
}

/** Verify a GM owns every asset on the `from` side they're offering. */
export async function assertOwnership(pkg: TradePackage) {
  const [fromTeam, toTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: pkg.fromTeamId }, select: { id: true, name: true, bankAccount: true, affiliateTeams: { select: { id: true } } } }),
    prisma.team.findUnique({ where: { id: pkg.toTeamId }, select: { id: true, name: true, bankAccount: true, affiliateTeams: { select: { id: true } } } }),
  ]);
  if (!fromTeam || !toTeam) throw new Error("Team not found");
  const fromOrg = orgIds(fromTeam), toOrg = orgIds(toTeam);

  const players = await prisma.player.findMany({ where: { id: { in: [...pkg.fromPlayers, ...pkg.toPlayers].map((p) => p.playerId) } }, select: { id: true, teamId: true } });
  for (const p of pkg.fromPlayers) { const pl = players.find((x) => x.id === p.playerId); if (!pl || !fromOrg.includes(pl.teamId ?? -1)) throw new Error("A player you offered is not on your team."); }
  for (const p of pkg.toPlayers) { const pl = players.find((x) => x.id === p.playerId); if (!pl || !toOrg.includes(pl.teamId ?? -1)) throw new Error("A requested player is not on the other team."); }

  const pickIds = [...pkg.fromPicks, ...pkg.toPicks];
  if (pickIds.length) {
    const picks = await prisma.draftPick.findMany({ where: { id: { in: pickIds } }, select: { id: true, teamId: true } });
    for (const id of pkg.fromPicks) { const pk = picks.find((x) => x.id === id); if (!pk || !fromOrg.includes(pk.teamId)) throw new Error("A draft pick you offered is not owned by your team."); }
    for (const id of pkg.toPicks) { const pk = picks.find((x) => x.id === id); if (!pk || !toOrg.includes(pk.teamId)) throw new Error("A requested draft pick is not owned by the other team."); }
  }
  const prospectIds = [...(pkg.fromProspects ?? []), ...(pkg.toProspects ?? [])];
  if (prospectIds.length) {
    const pros = await prisma.prospect.findMany({ where: { id: { in: prospectIds } }, select: { id: true, teamId: true } });
    for (const id of pkg.fromProspects ?? []) { const pr = pros.find((x) => x.id === id); if (!pr || !fromOrg.includes(pr.teamId)) throw new Error("A prospect you offered is not owned by your team."); }
    for (const id of pkg.toProspects ?? []) { const pr = pros.find((x) => x.id === id); if (!pr || !toOrg.includes(pr.teamId)) throw new Error("A requested prospect is not owned by the other team."); }
  }
  return { fromTeam, toTeam };
}

/** Rebuild the TradePackage from stored TradeAssets. */
export async function packageFromTrade(tradeId: number): Promise<TradePackage> {
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

/** Execute a PENDING trade by id: run the validated asset moves, mark it ACCEPTED,
 *  and log the public transaction. Shared by the human accept action and the AI.
 *  Returns team names for the follow-up notification. Throws on any violation. */
export async function executeAcceptedTrade(tradeId: number) {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found");
  // executable straight from a GM accept (PENDING) or after commission review of a rookie deal
  if (!["PENDING", "AWAITING_COMMISH", "MODIFIED"].includes(trade.status)) throw new Error("This trade is no longer pending.");
  const pkg = await packageFromTrade(tradeId);
  pkg.waived = trade.waivedClauses ?? [];
  pkg.clauseFees = (trade.clauseFees as TradePackage["clauseFees"]) ?? [];
  const { ops, fromTeam, toTeam, fromNames, toNames } = await collectMoveOps(pkg);
  ops.push(prisma.trade.update({ where: { id: tradeId }, data: { status: "ACCEPTED", respondedAt: new Date() } }));
  ops.push(prisma.transaction.create({
    data: { type: "TRADE", message: `${fromTeam.name} traded ${fromNames.join(", ") || "assets"} to ${toTeam.name} for ${toNames.join(", ") || "assets"}.` },
  }));
  await prisma.$transaction(ops);
  return { fromTeam, toTeam, fromNames, toNames };
}

/** Create a PENDING Trade + its TradeAssets + the notification DM. The auth/clause-
 *  consent checks are the CALLER's responsibility (the human action does them; the AI
 *  only builds clause-clean packages). Returns the new trade id. */
export async function createTradeRecord(pkg: TradePackage, opts: { fromName: string; toName: string; dmBody?: string; aiFrom?: boolean; leagueDay?: number } ) {
  const trade = await prisma.trade.create({ data: { fromTeamId: pkg.fromTeamId, toTeamId: pkg.toTeamId, status: "PENDING", condition: pkg.condition || null, leagueDay: opts.leagueDay ?? null, waivedClauses: [...(pkg.waived ?? []), ...(pkg.clauseFees ?? []).map((f) => f.playerId)], clauseFees: (pkg.clauseFees ?? []) as object } });
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
  await prisma.dmMessage.create({
    data: { fromTeamId: pkg.fromTeamId, toTeamId: pkg.toTeamId, body: opts.dmBody ?? `📩 ${opts.fromName} sent you a trade proposal — open it to review, then Accept or Decline.`, tradeUrl: `/trades/${trade.id}` },
  }).catch(() => {});
  return { tradeId: trade.id };
}
