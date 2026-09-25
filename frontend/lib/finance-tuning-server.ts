import { prisma } from "./prisma";
import { loadSettings } from "./sim/settings";
import { financeTuningFrom, type FinanceTuning } from "./finance-tuning";

export async function loadFinanceTuning(): Promise<FinanceTuning> {
  const s = await loadSettings().catch(() => null);
  return financeTuningFrom(s as unknown as Record<string, unknown> | null);
}

/** Days since each NHL player arrived at his CURRENT club by an accepted trade
 *  (only arrivals within the last `maxDays`). Drives the jersey trade boost. */
export async function recentTradeArrivals(maxDays = 150): Promise<Map<number, number>> {
  const since = new Date(Date.now() - maxDays * 86400000);
  const trades = await prisma.trade.findMany({
    where: { status: "ACCEPTED", OR: [{ respondedAt: { gte: since } }, { respondedAt: null, createdAt: { gte: since } }] },
    select: { id: true, fromTeamId: true, toTeamId: true, respondedAt: true, createdAt: true },
  });
  if (!trades.length) return new Map();
  const byId = new Map(trades.map((t) => [t.id, t]));
  const assets = await prisma.tradeAsset.findMany({ where: { tradeId: { in: trades.map((t) => t.id) }, assetType: "PLAYER", playerId: { not: null } }, select: { tradeId: true, playerId: true, side: true } });
  const players = new Map((await prisma.player.findMany({ where: { id: { in: assets.map((a) => a.playerId!) } }, select: { id: true, teamId: true } })).map((p) => [p.id, p.teamId]));
  const out = new Map<number, number>();
  for (const a of assets) {
    const t = byId.get(a.tradeId)!;
    const receiver = a.side === "FROM" ? t.toTeamId : t.fromTeamId; // FROM = moves fromTeam → toTeam
    if (players.get(a.playerId!) !== receiver) continue;             // since moved on again
    const days = Math.floor((Date.now() - (t.respondedAt ?? t.createdAt).getTime()) / 86400000);
    const prev = out.get(a.playerId!);
    if (prev == null || days < prev) out.set(a.playerId!, days);
  }
  return out;
}
