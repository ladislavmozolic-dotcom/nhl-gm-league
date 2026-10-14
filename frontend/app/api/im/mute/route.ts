import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { canAccessRoom } from "@/lib/im/server";

export const dynamic = "force-dynamic";

// Mute / unmute notifications (push) for one chat — just for me.
export async function POST(req: Request) {
  const me = await getTeamSession();
  const { roomId, muted, hours } = (await req.json().catch(() => ({}))) as { roomId?: number; muted?: boolean; hours?: number | null };
  if (!me || !roomId || !(await canAccessRoom(me, roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const until = muted && typeof hours === "number" && hours > 0 ? new Date(Date.now() + Math.min(hours, 24 * 365) * 3600_000) : null; // no hours → forever
  await prisma.imRead.upsert({ where: { roomId_teamId: { roomId, teamId: me } }, update: { muted: !!muted, mutedUntil: until }, create: { roomId, teamId: me, muted: !!muted, mutedUntil: until } });
  return NextResponse.json({ ok: true });
}
