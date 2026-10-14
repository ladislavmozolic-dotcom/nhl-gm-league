import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { canAccessRoom, chatEnabled, wire } from "@/lib/im/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await getTeamSession();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const roomId = Number(sp.get("roomId"));
  const before = Number(sp.get("before")) || 0;
  if (!roomId || !(await canAccessRoom(me, roomId)) || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rows = await prisma.imMessage.findMany({
    where: { roomId, ...(before ? { id: { lt: before } } : {}) },
    orderBy: { id: "desc" }, take: 50,
  });
  const peer = await prisma.imRead.findFirst({ where: { roomId, teamId: { not: me } }, select: { lastReadId: true }, orderBy: { lastReadId: "desc" } });
  return NextResponse.json({ messages: await wire(rows.reverse()), more: rows.length === 50, peerRead: peer?.lastReadId ?? 0 });
}
