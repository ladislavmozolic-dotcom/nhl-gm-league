"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/** Lightweight unread-DM info for the signed-in GM — polled by the global notifier
 *  so a new message pops a notification + refreshes the page even when idle. */
export async function unreadDmInfo(): Promise<{ ok: boolean; count: number; from?: string }> {
  const me = await getTeamSession();
  if (me == null) return { ok: false, count: 0 };
  const count = await prisma.dmMessage.count({ where: { toTeamId: me, readAt: null } });
  let from: string | undefined;
  if (count > 0) {
    const latest = await prisma.dmMessage.findFirst({
      where: { toTeamId: me, readAt: null }, orderBy: { id: "desc" },
      select: { fromTeam: { select: { code: true, name: true } } },
    });
    from = latest?.fromTeam?.code || latest?.fromTeam?.name || undefined;
  }
  return { ok: true, count, from };
}

/** Send a DM to another team (as the signed-in GM's team). */
export async function sendDm(toTeamId: number, body: string, tradeUrl?: string | null) {
  const from = await getTeamSession();
  if (!from) return { ok: false as const, error: "Sign in as a GM to send messages." };
  const text = body.trim();
  if (!text) return { ok: false as const, error: "Empty message." };
  if (toTeamId === from) return { ok: false as const, error: "You can't message yourself." };
  // only allow an internal trade link — never an arbitrary/`javascript:` URL rendered as a clickable link
  const safeTradeUrl = tradeUrl && /^\/trades\//.test(tradeUrl) ? tradeUrl : null;
  await prisma.dmMessage.create({ data: { fromTeamId: from, toTeamId, body: text.slice(0, 2000), tradeUrl: safeTradeUrl } });
  revalidatePath("/messages");
  return { ok: true as const };
}

/** The full thread with `otherTeamId`, marking their messages to me as read. */
export async function getConversation(otherTeamId: number) {
  const from = await getTeamSession();
  if (!from) return { ok: false as const, me: null, messages: [] as ConversationMsg[] };
  await prisma.dmMessage.updateMany({ where: { fromTeamId: otherTeamId, toTeamId: from, readAt: null }, data: { readAt: new Date() } });
  const rows = await prisma.dmMessage.findMany({
    where: { OR: [{ fromTeamId: from, toTeamId: otherTeamId }, { fromTeamId: otherTeamId, toTeamId: from }] },
    orderBy: { id: "asc" },
    select: { id: true, fromTeamId: true, body: true, tradeUrl: true, readAt: true, createdAt: true },
  });
  const messages: ConversationMsg[] = rows.map((r) => ({
    id: r.id, mine: r.fromTeamId === from, body: r.body, tradeUrl: r.tradeUrl,
    read: r.readAt != null, at: r.createdAt.toISOString(),
  }));
  return { ok: true as const, me: from, messages };
}
export type ConversationMsg = { id: number; mine: boolean; body: string; tradeUrl: string | null; read: boolean; at: string };

/** Every other GM team + unread count from them (for the conversation list). */
export async function listConversations() {
  const from = await getTeamSession();
  if (!from) return { ok: false as const, me: null, teams: [] as ConvTeam[] };
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false, id: { not: from } },
    select: { id: true, name: true, code: true, logoUrl: true, gmNickname: true, passwordHash: true },
    orderBy: { name: "asc" },
  });
  const [unread, sent, recv] = await Promise.all([
    prisma.dmMessage.groupBy({ by: ["fromTeamId"], where: { toTeamId: from, readAt: null }, _count: { _all: true } }),
    prisma.dmMessage.groupBy({ by: ["toTeamId"], where: { fromTeamId: from }, _max: { id: true } }),
    prisma.dmMessage.groupBy({ by: ["fromTeamId"], where: { toTeamId: from }, _max: { id: true } }),
  ]);
  const unreadMap = new Map(unread.map((u) => [u.fromTeamId, u._count._all]));
  // last message id per conversation (either direction) → recency sort
  const lastMap = new Map<number, number>();
  for (const s of sent) lastMap.set(s.toTeamId, Math.max(lastMap.get(s.toTeamId) ?? 0, s._max.id ?? 0));
  for (const r of recv) lastMap.set(r.fromTeamId, Math.max(lastMap.get(r.fromTeamId) ?? 0, r._max.id ?? 0));
  const out: ConvTeam[] = teams.map((t) => ({
    id: t.id, name: t.name, code: t.code, logoUrl: t.logoUrl,
    gm: t.gmNickname, hasGm: !!t.passwordHash, unread: unreadMap.get(t.id) ?? 0, lastId: lastMap.get(t.id) ?? 0,
  }));
  // active conversations (most recent message) float to the top; then teams you've
  // never messaged (GMs first, alphabetical).
  out.sort((a, b) => b.lastId - a.lastId || Number(b.hasGm) - Number(a.hasGm) || a.name.localeCompare(b.name));
  return { ok: true as const, me: from, teams: out };
}
export type ConvTeam = { id: number; name: string; code: string | null; logoUrl: string | null; gm: string | null; hasGm: boolean; unread: number; lastId: number };

/** Total unread DMs for the signed-in GM (menu badge). */
export async function unreadDmCount(): Promise<number> {
  const from = await getTeamSession();
  if (!from) return 0;
  return prisma.dmMessage.count({ where: { toTeamId: from, readAt: null } });
}
