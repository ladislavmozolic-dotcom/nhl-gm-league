// UNHL Chat — server helpers. Standalone from the older Messages (DmMessage) system.
import { prisma } from "@/lib/prisma";
import webpush from "web-push";
import type { ImMessage } from "@prisma/client";

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

export type PollWire = { id: number; question: string; multi: boolean; closed: boolean; options: { id: number; text: string; voters: number[] }[] };
export type WireMessage = {
  kind: string; imageUrl: string | null; file: { url: string; name: string; size: number } | null; pinned: boolean; poll: PollWire | null;
  edited: boolean; id: number; roomId: number; fromTeamId: number; body: string; at: string;
  replyTo: { id: number; fromTeamId: number; body: string } | null; deleted: boolean;
};

type PollRow = { id: number; question: string; multi: boolean; closed: boolean; options: { id: number; text: string; order: number; votes: { teamId: number }[] }[] };
export function pollWire(p: PollRow): PollWire {
  return { id: p.id, question: p.question, multi: p.multi, closed: p.closed, options: [...p.options].sort((a, b) => a.order - b.order).map((o) => ({ id: o.id, text: o.text, voters: o.votes.map((v) => v.teamId) })) };
}
export const pollInclude = { options: { include: { votes: { select: { teamId: true } } } } } as const;

export async function wire(rows: ImMessage[]): Promise<WireMessage[]> {
  const replyIds = [...new Set(rows.map((r) => r.replyToId).filter((x): x is number => x != null))];
  const replies = replyIds.length
    ? await prisma.imMessage.findMany({ where: { id: { in: replyIds } }, select: { id: true, fromTeamId: true, body: true, deletedAt: true } })
    : [];
  const rm = new Map(replies.map((r) => [r.id, r]));
  const pollIds = rows.filter((r) => r.kind === "poll" && !r.deletedAt).map((r) => r.id);
  const polls = pollIds.length ? await prisma.imPoll.findMany({ where: { messageId: { in: pollIds } }, include: pollInclude }) : [];
  const pm = new Map(polls.map((p) => [p.messageId, pollWire(p)]));
  return rows.map((r) => {
    const rp = r.replyToId != null ? rm.get(r.replyToId) : null;
    return {
      kind: r.kind, imageUrl: r.deletedAt ? null : r.imageUrl, edited: !!r.editedAt && !r.deletedAt, id: r.id, roomId: r.roomId, fromTeamId: r.fromTeamId,
      file: !r.deletedAt && r.fileUrl ? { url: r.fileUrl, name: r.fileName ?? "súbor", size: r.fileSize ?? 0 } : null,
      pinned: !!r.pinnedAt && !r.deletedAt, poll: pm.get(r.id) ?? null,
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

/** Group event line ("X pridal Y") shown centred in the thread. Not counted as unread, never pushed. */
export async function systemMessage(roomId: number, actorTeamId: number, body: string) {
  const m = await prisma.imMessage.create({ data: { roomId, fromTeamId: actorTeamId, body, kind: "system" } });
  await prisma.imRoom.update({ where: { id: roomId }, data: { lastMessageAt: m.createdAt } });
}

export async function teamLabels(ids: number[]): Promise<Map<number, string>> {
  const t = await prisma.team.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return new Map(t.map((x) => [x.id, x.name]));
}

// Only our own uploads or Giphy media may be attached / used as an avatar — never an arbitrary URL.
const OWN = /^\/uploads\/chat\/[a-f0-9]{16}\.(png|jpg|webp|gif)$/;
const GIPHY = /^https:\/\/media[0-9]*\.giphy\.com\/media\/[A-Za-z0-9_\-\/\.]+\.(gif|webp|mp4)(\?[A-Za-z0-9_=&\-\.]*)?$/;
export const isOwnImage = (u: unknown): u is string => typeof u === "string" && OWN.test(u);
export const isAttachableImage = (u: unknown): u is string => typeof u === "string" && (OWN.test(u) || GIPHY.test(u));

/** Leave a group (also used when a GM seat is wiped): system line, hand over ownership, drop empty groups. */
export async function leaveGroup(roomId: number, teamId: number) {
  const room = await prisma.imRoom.findUnique({ where: { id: roomId }, include: { members: true } });
  if (!room || room.kind !== "group" || !room.members.some((m) => m.teamId === teamId)) return;
  const L = await teamLabels([teamId]);
  await systemMessage(roomId, teamId, `${L.get(teamId)} opustil skupinu`); // while still a member so the others see it
  await prisma.imMember.delete({ where: { roomId_teamId: { roomId, teamId } } });
  const rest = room.members.filter((m) => m.teamId !== teamId).sort((a, c) => a.joinedAt.getTime() - c.joinedAt.getTime());
  if (!rest.length) await prisma.imRoom.delete({ where: { id: roomId } });
  else if (room.createdById === teamId) await prisma.imRoom.update({ where: { id: roomId }, data: { createdById: rest[0].teamId } });
}

const FILE_RE = /^\/uploads\/chat\/files\/[a-f0-9]{16}\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip)$/;
export const isOwnFile = (u: unknown): u is string => typeof u === "string" && FILE_RE.test(u);
