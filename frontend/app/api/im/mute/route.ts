import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { canAccessRoom } from "@/lib/im/server";

export const dynamic = "force-dynamic";

// Mute / unmute notifications (push) for one chat — just for me.
export async function POST(req: Request) {
  const me = await getTeamSession();
  const { roomId, muted } = (await req.json().catch(() => ({}))) as { roomId?: number; muted?: boolean };
  if (!me || !roomId || !(await canAccessRoom(me, roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await prisma.imRead.upsert({ where: { roomId_teamId: { roomId, teamId: me } }, update: { muted: !!muted }, create: { roomId, teamId: me, muted: !!muted } });
  return NextResponse.json({ ok: true });
}
