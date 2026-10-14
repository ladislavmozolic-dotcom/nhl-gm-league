import { prisma } from "@/lib/prisma";
import { MAX_LEN, canAccessRoom, dmRoomId, isAttachableImage, isMuted, isOwnFile, pushToTeams, wire, type WireMessage } from "./server";

export type PostInput = {
  roomId?: number; toTeamId?: number; body?: string; replyToId?: number; imageUrl?: string | null;
  file?: { url: string; name: string; size: number } | null;
  poll?: { question: string; options: string[]; multi: boolean } | null;
};
export type PostResult = { ok: true; roomId: number; message: WireMessage } | { ok: false; status: number; error: string };

/** The one place a message is created (text / photo / GIF / file / poll): validates, stores, bumps read pointer, sends web push. */
export async function postMessage(me: number, b: PostInput): Promise<PostResult> {
  const poll = b.poll
    ? { question: b.poll.question.trim().slice(0, 200), options: b.poll.options.map((o) => o.trim().slice(0, 80)).filter(Boolean).slice(0, 10), multi: !!b.poll.multi }
    : null;
  if (poll && (!poll.question || poll.options.length < 2)) return { ok: false, status: 400, error: "poll" };
  const body = poll ? poll.question : (b.body ?? "").trim().slice(0, MAX_LEN);
  const imageUrl = isAttachableImage(b.imageUrl) ? b.imageUrl : null;
  const file = b.file && isOwnFile(b.file.url) ? { url: b.file.url, name: String(b.file.name ?? "súbor").replace(/[\u0000-\u001f<>]/g, "").slice(0, 120) || "súbor", size: Math.max(0, Math.floor(Number(b.file.size) || 0)) } : null;
  if (!body && !imageUrl && !file) return { ok: false, status: 400, error: "empty" };

  let roomId = b.roomId ?? 0;
  if (!roomId && b.toTeamId) {
    if (b.toTeamId === me) return { ok: false, status: 400, error: "self" };
    const peer = await prisma.team.findUnique({ where: { id: b.toTeamId }, select: { passwordHash: true } });
    if (!peer?.passwordHash) return { ok: false, status: 400, error: "no-chat" };
    roomId = await dmRoomId(me, b.toTeamId);
  }
  if (!roomId || !(await canAccessRoom(me, roomId))) return { ok: false, status: 403, error: "forbidden" };
  const room = await prisma.imRoom.findUnique({ where: { id: roomId } });
  if (room?.kind === "league" && (await isMuted(me))) return { ok: false, status: 403, error: "muted" };

  let replyToId: number | null = null;
  if (b.replyToId) {
    const r = await prisma.imMessage.findUnique({ where: { id: b.replyToId }, select: { roomId: true } });
    if (r?.roomId === roomId) replyToId = b.replyToId;
  }
  const msg = await prisma.imMessage.create({
    data: {
      roomId, fromTeamId: me, body, replyToId, imageUrl, kind: poll ? "poll" : "user",
      ...(file ? { fileUrl: file.url, fileName: file.name, fileSize: file.size } : {}),
      ...(poll ? { poll: { create: { question: poll.question, multi: poll.multi, options: { create: poll.options.map((text, order) => ({ text, order })) } } } } : {}),
    },
  });
  await prisma.imRoom.update({ where: { id: roomId }, data: { lastMessageAt: msg.createdAt } });
  await prisma.imRead.upsert({ where: { roomId_teamId: { roomId, teamId: me } }, update: { lastReadId: msg.id }, create: { roomId, teamId: me, lastReadId: msg.id } });

  // web push (fire-and-forget): DM → the peer; group → members; league → every signed-up device
  const sender = await prisma.team.findUnique({ where: { id: me }, select: { code: true, gmNickname: true } });
  const who = sender?.gmNickname || sender?.code || "GM";
  let targets: number[] = [];
  let title = who;
  if (room?.kind === "dm" && room.dmKey) targets = room.dmKey.split("-").map(Number).filter((x) => x !== me);
  else if (room?.kind === "group") {
    title = `${room.name ?? "Skupina"} · ${who}`;
    targets = (await prisma.imMember.findMany({ where: { roomId, teamId: { not: me } }, select: { teamId: true } })).map((m) => m.teamId);
  } else {
    title = `# ${room?.name || "League"} · ${who}`;
    targets = (await prisma.imPushSub.findMany({ where: { teamId: { not: me } }, select: { teamId: true }, distinct: ["teamId"] })).map((s) => s.teamId);
  }
  const mutedSet = new Set((await prisma.imRead.findMany({ where: { roomId, muted: true, teamId: { in: targets } }, select: { teamId: true } })).map((r) => r.teamId));
  targets = targets.filter((t) => !mutedSet.has(t));
  const preview = poll ? `📊 ${poll.question}` : file && !body ? `📎 ${file.name}` : body ? body.slice(0, 140) : /\.gif|giphy/i.test(imageUrl ?? "") ? "GIF" : "📷 Fotka";
  void pushToTeams(targets, { title, body: preview, url: "/chat", tag: `room-${roomId}` }).catch(() => {});
  return { ok: true, roomId, message: (await wire([msg]))[0] };
}
