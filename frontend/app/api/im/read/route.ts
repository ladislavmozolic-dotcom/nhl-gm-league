import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { canAccessRoom } from "@/lib/im/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { roomId, lastReadId } = (await req.json().catch(() => ({}))) as { roomId?: number; lastReadId?: number };
  if (!roomId || !lastReadId || !(await canAccessRoom(me, roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cur = await prisma.imRead.findUnique({ where: { roomId_teamId: { roomId, teamId: me } } });
  if ((cur?.lastReadId ?? 0) < lastReadId) {
    await prisma.imRead.upsert({ where: { roomId_teamId: { roomId, teamId: me } }, update: { lastReadId }, create: { roomId, teamId: me, lastReadId } });
  }
  return NextResponse.json({ ok: true });
}
