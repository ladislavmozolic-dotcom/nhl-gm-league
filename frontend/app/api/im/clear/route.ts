import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { canAccessRoom } from "@/lib/im/server";

export const dynamic = "force-dynamic";

// "Delete conversation" — for ME only (the other side keeps it). Hides everything up to now;
// a new message from the other side brings the chat back with just the new messages.
export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { roomId } = (await req.json().catch(() => ({}))) as { roomId?: number };
  const room = roomId ? await prisma.imRoom.findUnique({ where: { id: roomId }, select: { kind: true } }) : null;
  if (!roomId || !room || room.kind === "league" || !(await canAccessRoom(me, roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const last = (await prisma.imMessage.findFirst({ where: { roomId }, orderBy: { id: "desc" }, select: { id: true } }))?.id ?? 0;
  await prisma.imRead.upsert({
    where: { roomId_teamId: { roomId, teamId: me } }, update: { clearedId: last, lastReadId: last }, create: { roomId, teamId: me, lastReadId: last, clearedId: last },
  });
  return NextResponse.json({ ok: true });
}
