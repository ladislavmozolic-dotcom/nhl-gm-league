import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/playerName";
import { money } from "@/lib/finance";

export type TradeSummary = { from: string[]; to: string[] };

/** Short "who sent what" for a batch of trades, keyed by trade id — the same
 *  asset formatting /trades/[id] uses (player/prospect/pick/cash), one label
 *  per asset (no logos) for a list page to render as its own chips/pills.
 *  `from`/`to` mirror TradeAsset.side: `from` = what the trade's fromTeam sent,
 *  `to` = what the toTeam sent. One batched query set regardless of how many
 *  trade ids are passed, so a list page can call this once for the whole table. */
export async function tradeSummaries(tradeIds: number[]): Promise<Map<number, TradeSummary>> {
  const out = new Map<number, TradeSummary>();
  if (tradeIds.length === 0) return out;
  const assets = await prisma.tradeAsset.findMany({ where: { tradeId: { in: tradeIds } } });
  const [players, prospects, picks] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: assets.filter((a) => a.playerId).map((a) => a.playerId!) } }, select: { id: true, name: true } }),
    prisma.prospect.findMany({ where: { id: { in: assets.filter((a) => a.prospectId).map((a) => a.prospectId!) } }, select: { id: true, name: true } }),
    prisma.draftPick.findMany({ where: { id: { in: assets.filter((a) => a.draftPickId).map((a) => a.draftPickId!) } }, select: { id: true, year: true, round: true } }),
  ]);
  const pName = new Map(players.map((p) => [p.id, p.name]));
  const proName = new Map(prospects.map((p) => [p.id, p.name]));
  const pickLabel = new Map(picks.map((p) => [p.id, `${p.year} R${p.round}`]));
  const label = (a: (typeof assets)[number]): string => {
    if (a.assetType === "PLAYER") return `${displayName(pName.get(a.playerId ?? -1) ?? "Player")}${a.retentionPct ? ` (${a.retentionPct}% ret.)` : ""}`;
    if (a.assetType === "PROSPECT") return `⭐ ${displayName(proName.get(a.prospectId ?? -1) ?? "Prospect")}`;
    if (a.assetType === "PICK") return `🎫 ${pickLabel.get(a.draftPickId ?? -1) ?? "Pick"}`;
    if (a.assetType === "CASH") return `💵 ${money(a.cashAmount ?? 0)}`;
    return a.assetType;
  };
  const grouped = new Map<number, { from: string[]; to: string[] }>();
  for (const id of tradeIds) grouped.set(id, { from: [], to: [] });
  for (const a of assets) {
    const g = grouped.get(a.tradeId);
    if (!g) continue;
    (a.side === "FROM" ? g.from : g.to).push(label(a));
  }
  for (const [id, g] of grouped) out.set(id, { from: g.from, to: g.to });
  return out;
}
