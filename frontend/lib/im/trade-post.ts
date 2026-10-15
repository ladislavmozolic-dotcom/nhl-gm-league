import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/playerName";
import { postSystemToRoom } from "./post";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unhl.eu";
const money = (n: number | null | undefined) => (n ? `$${(n / 1e6).toFixed(Number.isInteger(n / 1e5) ? 1 : 2)}M` : "");

type Leg = { fromId: number; toId: number; fromLines: string[]; toLines: string[]; condition: string | null };

async function describeLeg(tradeId: number): Promise<Leg | null> {
  const t = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!t) return null;
  const assets = await prisma.tradeAsset.findMany({ where: { tradeId } });
  const players = await prisma.player.findMany({ where: { id: { in: assets.map((a) => a.playerId).filter((x): x is number => x != null) } }, select: { id: true, name: true, position: true, capHit: true, contractYears: true } });
  const picks = await prisma.draftPick.findMany({ where: { id: { in: assets.map((a) => a.draftPickId).filter((x): x is number => x != null) } }, select: { id: true, year: true, round: true, team: { select: { code: true } } } });
  const prospects = await prisma.prospect.findMany({ where: { id: { in: assets.map((a) => a.prospectId).filter((x): x is number => x != null) } }, select: { id: true, name: true, position: true } });
  const pm = new Map(players.map((p) => [p.id, p])), km = new Map(picks.map((p) => [p.id, p])), sm = new Map(prospects.map((p) => [p.id, p]));
  const line = (a: (typeof assets)[number]) => {
    if (a.assetType === "PLAYER" && a.playerId) {
      const p = pm.get(a.playerId); if (!p) return null;
      const bits = [p.position, p.capHit ? money(p.capHit) : "", p.contractYears != null ? `${p.contractYears} r.` : "", a.retentionPct ? `zadržaných ${Math.round(a.retentionPct)}% platu` : ""].filter(Boolean);
      return `• ${displayName(p.name)}${bits.length ? ` (${bits.join(" · ")})` : ""}`;
    }
    if (a.assetType === "PICK" && a.draftPickId) { const k = km.get(a.draftPickId); return k ? `• ${k.year} – ${k.round}. kolo (${k.team?.code ?? "?"})` : null; }
    if (a.assetType === "PROSPECT" && a.prospectId) { const p = sm.get(a.prospectId); return p ? `• prospekt ${displayName(p.name)}${p.position ? ` (${p.position})` : ""}` : null; }
    if (a.assetType === "CASH" && a.cashAmount) return `• hotovosť ${money(a.cashAmount)}`;
    return null;
  };
  const side = (v: "FROM" | "TO") => assets.filter((a) => a.side === v).map(line).filter((x): x is string => !!x);
  return { fromId: t.fromTeamId, toId: t.toTeamId, fromLines: side("FROM"), toLines: side("TO"), condition: t.condition };
}

async function gmNames(ids: number[]) {
  const t = await prisma.team.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, gmNickname: true } });
  return new Map(t.map((x) => [x.id, { name: x.name, gm: x.gmNickname }]));
}
const label = (n?: { name: string; gm: string | null }) => (n ? `${n.name}${n.gm ? ` (${n.gm})` : ""}` : "?");

/** Where executed trades are announced (admin setting) — null when switched off. */
async function tradeRoom(): Promise<number | null> {
  return (await prisma.imSettings.findUnique({ where: { id: 1 }, select: { tradeRoomId: true, enabled: true } }).catch(() => null))?.tradeRoomId ?? null;
}

/** An executed 2-team trade → one card in the chosen chat. Best-effort: never throws into the trade flow. */
export async function postTradeToChat(tradeId: number): Promise<void> {
  try {
    const roomId = await tradeRoom(); if (!roomId) return;
    const leg = await describeLeg(tradeId); if (!leg) return;
    const n = await gmNames([leg.fromId, leg.toId]);
    const body = [
      "🔄 OBCHOD SCHVÁLENÝ",
      `${label(n.get(leg.fromId))}  ⇄  ${label(n.get(leg.toId))}`, "",
      `${n.get(leg.fromId)?.name ?? "?"} dáva:`, ...(leg.fromLines.length ? leg.fromLines : ["• budúce úvahy"]), "",
      `${n.get(leg.toId)?.name ?? "?"} dáva:`, ...(leg.toLines.length ? leg.toLines : ["• budúce úvahy"]),
      ...(leg.condition ? ["", `Podmienka: ${leg.condition}`] : []), "",
      `Detail: ${SITE}/trades/${tradeId}`,
    ].join("\n");
    await postSystemToRoom(roomId, "trade", body, "🔄 Nový obchod");
  } catch (e) { console.error("[chat] postTradeToChat failed", e); }
}

/** An executed 3-team trade (several one-way legs). */
export async function postTradeGroupToChat(groupId: number): Promise<void> {
  try {
    const roomId = await tradeRoom(); if (!roomId) return;
    const legs = (await prisma.trade.findMany({ where: { groupId }, select: { id: true } })).map((l) => l.id);
    const described = (await Promise.all(legs.map(describeLeg))).filter((x): x is Leg => !!x);
    const n = await gmNames([...new Set(described.flatMap((l) => [l.fromId, l.toId]))]);
    const body = [
      "🔄 3-TÍMOVÝ OBCHOD SCHVÁLENÝ", [...n.values()].map((x) => label(x)).join("  ⇄  "), "",
      ...described.flatMap((l) => [`${n.get(l.fromId)?.name ?? "?"} → ${n.get(l.toId)?.name ?? "?"}:`, ...(l.fromLines.length ? l.fromLines : ["• budúce úvahy"]), ""]),
      `Detail: ${SITE}/trades`,
    ].join("\n");
    await postSystemToRoom(roomId, "trade", body, "🔄 Nový 3-tímový obchod");
  } catch (e) { console.error("[chat] postTradeGroupToChat failed", e); }
}

export async function postTradeTest(): Promise<boolean> {
  const roomId = await tradeRoom(); if (!roomId) return false;
  await postSystemToRoom(roomId, "trade", "🧪 SKÚŠKA OBCHODNÉHO KANÁLA\nSem budú chodiť automatické karty o každom schválenom obchode — kto za koho, hráči, picky, hotovosť a podmienky.", "🧪 Skúška");
  return true;
}
