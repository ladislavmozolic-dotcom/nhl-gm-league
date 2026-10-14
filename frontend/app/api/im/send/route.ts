import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { MAX_LEN, canAccessRoom, chatEnabled, dmRoomId, isMuted, leagueRoomId, pushToTeams, wire } from "@/lib/im/server";

export const dynamic = "force-dynamic";

// Send to an existing room (roomId) or open/get a DM with a club (toTeamId).
export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!(await chatEnabled())) return NextResponse.json({ error: "disabled" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { roomId?: number; toTeamId?: number; body?: string; replyToId?: number };
  const body = (b.body ?? "").trim().slice(0, MAX_LEN);
  if (!body) return NextResponse.json({ error: "empty" }, { status: 400 });

  let roomId = b.roomId ?? 0;
  if (!roomId && b.toTeamId) {
    if (b.toTeamId === me) return NextResponse.json({ error: "self" }, { status: 400 });
    const peer = await prisma.team.findUnique({ where: { id: b.toTeamId }, select: { passwordHash: true } });
    if (!peer?.passwordHash) return NextResponse.json({ error: "no-chat" }, { status: 400 });
    roomId = await dmRoomId(me, b.toTeamId);
  }
  if (!roomId || !(await canAccessRoom(me, roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const room = await prisma.imRoom.findUnique({ where: { id: roomId } });
  if (room?.kind === "league" && (await isMuted(me))) return NextResponse.json({ error: "muted" }, { status: 403 });

  let replyToId: number | null = null;
  if (b.replyToId) {
    const r = await prisma.imMessage.findUnique({ where: { id: b.replyToId }, select: { roomId: true } });
    if (r?.roomId === roomId) replyToId = b.replyToId;
  }
  const msg = await prisma.imMessage.create({ data: { roomId, fromTeamId: me, body, replyToId } });
  await prisma.imRoom.update({ where: { id: roomId }, data: { lastMessageAt: msg.createdAt } });
  await prisma.imRead.upsert({
    where: { roomId_teamId: { roomId, teamId: me } }, update: { lastReadId: msg.id }, create: { roomId, teamId: me, lastReadId: msg.id },
  });

  // web push (fire-and-forget): DM → the peer; league → every other signed-up device
  const sender = await prisma.team.findUnique({ where: { id: me }, select: { code: true, name: true, gmNickname: true } });
  const who = sender?.gmNickname || sender?.code || "GM";
  let targets: number[] = [];
  let title = who;
  if (room?.kind === "dm" && room.dmKey) {
    targets = room.dmKey.split("-").map(Number).filter((x) => x !== me);
  } else {
    title = `# League · ${who}`;
    targets = (await prisma.imPushSub.findMany({ where: { teamId: { not: me } }, select: { teamId: true }, distinct: ["teamId"] })).map((s) => s.teamId);
  }
  void pushToTeams(targets, { title, body: body.slice(0, 140), url: "/chat", tag: `room-${roomId}` }).catch(() => {});
  void leagueRoomId;
  return NextResponse.json({ ok: true, roomId, message: (await wire([msg]))[0] });
}
