// UNHL Chat — server helpers. Standalone from the older Messages (DmMessage) system.
import { prisma } from "@/lib/prisma";
import webpush from "web-push";

export const MAX_LEN = 2000;

export async function chatEnabled(): Promise<boolean> {
  const s = await prisma.imSettings.findUnique({ where: { id: 1 } }).catch(() => null);
  return !!s?.enabled;
}

export async function leagueRoomId(): Promise<number> {
  const r = await prisma.imRoom.findFirst({ where: { kind: "league" }, select: { id: true } });
  if (r) return r.id;
  return (await prisma.imRoom.create({ data: { kind: "league" }, select: { id: true } })).id;
}

export function dmKey(a: number, b: number) {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

export async function dmRoomId(a: number, b: number): Promise<number> {
  const key = dmKey(a, b);
  const r = await prisma.imRoom.upsert({ where: { dmKey: key }, update: {}, create: { kind: "dm", dmKey: key }, select: { id: true } });
  return r.id;
}

/** Rooms a team may see: the league room + every DM it is part of. */
export async function myRoomIds(teamId: number): Promise<number[]> {
  const league = await leagueRoomId();
  const dms = await prisma.imRoom.findMany({
    where: { kind: "dm", OR: [{ dmKey: { startsWith: `${teamId}-` } }, { dmKey: { endsWith: `-${teamId}` } }] },
    select: { id: true },
  });
  const groups = await prisma.imMember.findMany({ where: { teamId }, select: { roomId: true } });
  return [league, ...dms.map((d) => d.id), ...groups.map((g) => g.roomId)];
}

export async function canAccessRoom(teamId: number, roomId: number): Promise<boolean> {
  return (await myRoomIds(teamId)).includes(roomId);
}

export async function isMuted(teamId: number): Promise<boolean> {
  const m = await prisma.imMute.findUnique({ where: { teamId } });
  if (!m) return false;
  if (m.until && m.until < new Date()) { await prisma.imMute.delete({ where: { teamId } }).catch(() => {}); return false; }
  return true;
}

export type WireMessage = {
  id: number; roomId: number; fromTeamId: number; body: string; at: string;
  replyTo: { id: number; fromTeamId: number; body: string } | null; deleted: boolean;
};

export async function wire(rows: { id: number; roomId: number; fromTeamId: number; body: string; createdAt: Date; replyToId: number | null; deletedAt: Date | null }[]): Promise<WireMessage[]> {
  const replyIds = [...new Set(rows.map((r) => r.replyToId).filter((x): x is number => x != null))];
  const replies = replyIds.length
    ? await prisma.imMessage.findMany({ where: { id: { in: replyIds } }, select: { id: true, fromTeamId: true, body: true, deletedAt: true } })
    : [];
  const rm = new Map(replies.map((r) => [r.id, r]));
  return rows.map((r) => {
    const rp = r.replyToId != null ? rm.get(r.replyToId) : null;
    return {
      id: r.id, roomId: r.roomId, fromTeamId: r.fromTeamId,
      body: r.deletedAt ? "" : r.body, deleted: !!r.deletedAt, at: r.createdAt.toISOString(),
      replyTo: rp ? { id: rp.id, fromTeamId: rp.fromTeamId, body: rp.deletedAt ? "" : rp.body.slice(0, 140) } : null,
    };
  });
}

// ── web push ────────────────────────────────────────────────────────────────
let pushReady: boolean | null = null;
function initPush() {
  if (pushReady != null) return pushReady;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (pushReady = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@unhl.eu", pub, priv);
  return (pushReady = true);
}

export async function pushToTeams(teamIds: number[], payload: { title: string; body: string; url: string; tag: string }) {
  if (!teamIds.length || !initPush()) return;
  const subs = await prisma.imPushSub.findMany({ where: { teamId: { in: teamIds } } });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await prisma.imPushSub.delete({ where: { id: s.id } }).catch(() => {});
    }
  }));
}
