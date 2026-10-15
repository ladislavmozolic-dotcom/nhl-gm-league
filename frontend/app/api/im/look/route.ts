import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { canAccessRoom, chatEnabled } from "@/lib/im/server";
import { BG_KEYS, FONT_KEYS } from "@/lib/im/looks";

export const dynamic = "force-dynamic";

// Chat look (background + font) — shared by everyone in the chat. Group: its founder (or the commissioner if a member);
// league channel: commissioner. { roomId, bg, font }
export async function POST(req: Request) {
  const me = await getTeamSession();
  const b = (await req.json().catch(() => ({}))) as { roomId?: number; bg?: string; font?: string };
  if (!me || !b.roomId || !(await chatEnabled()) || !(await canAccessRoom(me, b.roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const room = await prisma.imRoom.findUnique({ where: { id: b.roomId }, select: { kind: true, createdById: true } });
  if (!room || room.kind === "dm") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = await isAdmin();
  if (!(admin || (room.kind === "group" && room.createdById === me))) return NextResponse.json({ error: "owner-only" }, { status: 403 });
  const bg = (BG_KEYS as readonly string[]).includes(b.bg ?? "") ? b.bg! : "none";
  const font = (FONT_KEYS as readonly string[]).includes(b.font ?? "") ? b.font! : "default";
  await prisma.imRoom.update({ where: { id: b.roomId }, data: { bg: bg === "none" ? null : bg, font: font === "default" ? null : font } });
  return NextResponse.json({ ok: true });
}
