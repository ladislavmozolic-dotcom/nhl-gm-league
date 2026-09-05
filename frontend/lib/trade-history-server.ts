// Player-profile "Trade History" — every completed (or later-reverted) trade a
// player has been part of, oldest → newest, with the full package resolved on
// both sides. Mirrors the asset-label resolution in app/trades/[id]/page.tsx.

import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import { money } from "@/lib/finance";

export type TradeHistoryAssetItem = { text: string; logoUrl?: string | null };
export type TradeHistoryTeam = { name: string | null; code: string | null; logoUrl: string | null };
export type TradeHistoryEntry = {
  tradeId: number;
  date: Date;
  status: string; // ACCEPTED | REVERTED
  fromTeam: TradeHistoryTeam | null;
  toTeam: TradeHistoryTeam | null;
  fromLabels: TradeHistoryAssetItem[];
  toLabels: TradeHistoryAssetItem[];
};

export async function playerTradeHistory(playerId: number): Promise<TradeHistoryEntry[]> {
  const myAssets = await prisma.tradeAsset.findMany({ where: { playerId, assetType: "PLAYER" }, select: { tradeId: true } });
  const tradeIds = [...new Set(myAssets.map((a) => a.tradeId))];
  if (!tradeIds.length) return [];

  const trades = await prisma.trade.findMany({
    where: { id: { in: tradeIds }, status: { in: ["ACCEPTED", "REVERTED"] } },
    orderBy: [{ respondedAt: "asc" }, { createdAt: "asc" }],
  });
  if (!trades.length) return [];

  const allAssets = await prisma.tradeAsset.findMany({ where: { tradeId: { in: trades.map((t) => t.id) } } });
  const teamIds = [...new Set(trades.flatMap((t) => [t.fromTeamId, t.toTeamId]))];
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true, code: true, logoUrl: true } });
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const playerIds = [...new Set(allAssets.filter((a) => a.playerId).map((a) => a.playerId!))];
  const prospectIds = [...new Set(allAssets.filter((a) => a.prospectId).map((a) => a.prospectId!))];
  const pickIds = [...new Set(allAssets.filter((a) => a.draftPickId).map((a) => a.draftPickId!))];
  const [players, prospects, picks] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, name: true } }),
    prisma.prospect.findMany({ where: { id: { in: prospectIds } }, select: { id: true, name: true } }),
    prisma.draftPick.findMany({ where: { id: { in: pickIds } }, select: { id: true, year: true, round: true, ownerLogoId: true } }),
  ]);
  const pName = new Map(players.map((p) => [p.id, p.name]));
  const proName = new Map(prospects.map((p) => [p.id, p.name]));
  const origTeams = picks.length
    ? await prisma.team.findMany({ where: { profinhlLogoId: { in: picks.map((p) => p.ownerLogoId).filter((x): x is number => x != null) } }, select: { profinhlLogoId: true, code: true, name: true, logoUrl: true } })
    : [];
  const teamByLogoId = new Map(origTeams.map((t) => [t.profinhlLogoId, t]));
  const pickInfo = new Map(picks.map((p) => [p.id, { label: `${p.year} R${p.round}`, origTeam: teamByLogoId.get(p.ownerLogoId) ?? null }]));

  const assetsByTrade = new Map<number, typeof allAssets>();
  for (const a of allAssets) {
    if (!assetsByTrade.has(a.tradeId)) assetsByTrade.set(a.tradeId, []);
    assetsByTrade.get(a.tradeId)!.push(a);
  }

  const labelsFor = (assets: typeof allAssets, side: "FROM" | "TO"): TradeHistoryAssetItem[] =>
    assets.filter((a) => a.side === side).map((a): TradeHistoryAssetItem => {
      if (a.assetType === "PLAYER") return { text: `${cleanName(pName.get(a.playerId ?? -1) ?? "Player")}${a.retentionPct ? ` (${a.retentionPct}% ret.)` : ""}` };
      if (a.assetType === "PROSPECT") return { text: `⭐ ${cleanName(proName.get(a.prospectId ?? -1) ?? "Prospect")}` };
      if (a.assetType === "PICK") {
        const info = pickInfo.get(a.draftPickId ?? -1);
        const orig = info?.origTeam;
        return { text: `🎫 ${info?.label ?? "Pick"}${orig ? ` (${orig.code ?? orig.name})` : ""}`, logoUrl: orig?.logoUrl };
      }
      if (a.assetType === "CASH") return { text: `💵 ${money(a.cashAmount ?? 0)}` };
      return { text: a.assetType };
    });

  return trades.map((t) => {
    const assets = assetsByTrade.get(t.id) ?? [];
    return {
      tradeId: t.id,
      date: t.respondedAt ?? t.createdAt,
      status: t.status,
      fromTeam: teamById.get(t.fromTeamId) ?? null,
      toTeam: teamById.get(t.toTeamId) ?? null,
      fromLabels: labelsFor(assets, "FROM"),
      toLabels: labelsFor(assets, "TO"),
    };
  });
}

/** Every completed (or later-reverted) trade a specific draft pick changed
 *  hands in — same shape/resolution as playerTradeHistory, just keyed off
 *  TradeAsset.draftPickId instead of .playerId. Powers the "which trade got
 *  us this pick?" popup on All Rosters / a team's draft-picks page. */
export async function pickTradeHistory(pickId: number): Promise<TradeHistoryEntry[]> {
  const pickAssets = await prisma.tradeAsset.findMany({ where: { draftPickId: pickId, assetType: "PICK" }, select: { tradeId: true } });
  const tradeIds = [...new Set(pickAssets.map((a) => a.tradeId))];
  if (!tradeIds.length) return [];

  const trades = await prisma.trade.findMany({
    where: { id: { in: tradeIds }, status: { in: ["ACCEPTED", "REVERTED"] } },
    orderBy: [{ respondedAt: "asc" }, { createdAt: "asc" }],
  });
  if (!trades.length) return [];

  const allAssets = await prisma.tradeAsset.findMany({ where: { tradeId: { in: trades.map((t) => t.id) } } });
  const teamIds = [...new Set(trades.flatMap((t) => [t.fromTeamId, t.toTeamId]))];
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true, code: true, logoUrl: true } });
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const playerIds = [...new Set(allAssets.filter((a) => a.playerId).map((a) => a.playerId!))];
  const prospectIds = [...new Set(allAssets.filter((a) => a.prospectId).map((a) => a.prospectId!))];
  const pickIds = [...new Set(allAssets.filter((a) => a.draftPickId).map((a) => a.draftPickId!))];
  const [players, prospects, picks] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, name: true } }),
    prisma.prospect.findMany({ where: { id: { in: prospectIds } }, select: { id: true, name: true } }),
    prisma.draftPick.findMany({ where: { id: { in: pickIds } }, select: { id: true, year: true, round: true, ownerLogoId: true } }),
  ]);
  const pName = new Map(players.map((p) => [p.id, p.name]));
  const proName = new Map(prospects.map((p) => [p.id, p.name]));
  const origTeams = picks.length
    ? await prisma.team.findMany({ where: { profinhlLogoId: { in: picks.map((p) => p.ownerLogoId).filter((x): x is number => x != null) } }, select: { profinhlLogoId: true, code: true, name: true, logoUrl: true } })
    : [];
  const teamByLogoId = new Map(origTeams.map((t) => [t.profinhlLogoId, t]));
  const pickInfo = new Map(picks.map((p) => [p.id, { label: `${p.year} R${p.round}`, origTeam: teamByLogoId.get(p.ownerLogoId) ?? null }]));

  const assetsByTrade = new Map<number, typeof allAssets>();
  for (const a of allAssets) {
    if (!assetsByTrade.has(a.tradeId)) assetsByTrade.set(a.tradeId, []);
    assetsByTrade.get(a.tradeId)!.push(a);
  }

  const labelsFor = (assets: typeof allAssets, side: "FROM" | "TO"): TradeHistoryAssetItem[] =>
    assets.filter((a) => a.side === side).map((a): TradeHistoryAssetItem => {
      if (a.assetType === "PLAYER") return { text: `${cleanName(pName.get(a.playerId ?? -1) ?? "Player")}${a.retentionPct ? ` (${a.retentionPct}% ret.)` : ""}` };
      if (a.assetType === "PROSPECT") return { text: `⭐ ${cleanName(proName.get(a.prospectId ?? -1) ?? "Prospect")}` };
      if (a.assetType === "PICK") {
        const info = pickInfo.get(a.draftPickId ?? -1);
        const orig = info?.origTeam;
        return { text: `🎫 ${info?.label ?? "Pick"}${orig ? ` (${orig.code ?? orig.name})` : ""}`, logoUrl: orig?.logoUrl };
      }
      if (a.assetType === "CASH") return { text: `💵 ${money(a.cashAmount ?? 0)}` };
      return { text: a.assetType };
    });

  return trades.map((t) => {
    const assets = assetsByTrade.get(t.id) ?? [];
    return {
      tradeId: t.id,
      date: t.respondedAt ?? t.createdAt,
      status: t.status,
      fromTeam: teamById.get(t.fromTeamId) ?? null,
      toTeam: teamById.get(t.toTeamId) ?? null,
      fromLabels: labelsFor(assets, "FROM"),
      toLabels: labelsFor(assets, "TO"),
    };
  });
}

/** Bulk check — which of these draft-pick ids have ever moved in a trade, so a
 *  list page can render only those as clickable without an N+1 query. */
export async function pickIdsWithTradeHistory(pickIds: number[]): Promise<Set<number>> {
  if (!pickIds.length) return new Set();
  const rows = await prisma.tradeAsset.findMany({ where: { draftPickId: { in: pickIds }, assetType: "PICK" }, select: { draftPickId: true } });
  return new Set(rows.map((r) => r.draftPickId!));
}

export type PlayerEventEntry = { id: string; date: Date; kind: "TRADE_BLOCK" | "WAIVER" | "SIGNING"; message: string };

/** Everything else that happened to a player outside of trades: trade-block
 *  adds/removes, waiver placements/claims/clears, and contract signings or
 *  extensions — newest first. Trade-block/waiver events only exist from the
 *  point Transaction.playerId started being recorded; older rows are null and
 *  won't surface here. Signings go back further since SigningLog always had
 *  a playerId column. */
export async function playerTransactionHistory(playerId: number): Promise<PlayerEventEntry[]> {
  const [txs, signings] = await Promise.all([
    prisma.transaction.findMany({ where: { playerId, type: { in: ["TRADE_BLOCK", "WAIVER"] } }, orderBy: { createdAt: "desc" } }),
    prisma.signingLog.findMany({ where: { playerId }, orderBy: { createdAt: "desc" } }),
  ]);
  const events: PlayerEventEntry[] = [
    ...txs.map((t): PlayerEventEntry => ({ id: `tx${t.id}`, date: t.createdAt, kind: t.type as "TRADE_BLOCK" | "WAIVER", message: t.message })),
    ...signings.map((s): PlayerEventEntry => {
      const term = `${money(s.salary)}/yr × ${s.years} yr${s.years === 1 ? "" : "s"}`;
      const verb = s.kind === "EXTEND" ? "Extended" : "Signed";
      return {
        id: `sl${s.id}`, date: s.createdAt, kind: "SIGNING",
        message: s.reverted ? `${verb} (${term}) — later reverted` : `${verb} ${s.teamCode ? `by ${s.teamCode} ` : ""}for ${term}`,
      };
    }),
  ];
  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}
