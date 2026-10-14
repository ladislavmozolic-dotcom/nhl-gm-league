import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { canAccessRoom, chatEnabled, systemMessage, teamLabels } from "@/lib/im/server";

export const dynamic = "force-dynamic";
const MAX_PINS = 10;

// Pin / unpin a message to the top of its chat: { id, pinned }.
// DM & group: any member. League channel: commissioner only.
export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, pinned } = (await req.json().catch(() => ({}))) as { id?: number; pinned?: boolean };
  const m = id ? await prisma.imMessage.findUnique({ where: { id }, include: { room: { select: { kind: true } } } }) : null;
  if (!m || m.deletedAt || m.kind === "system" || !(await canAccessRoom(me, m.roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (m.room.kind === "league" && !(await isAdmin())) return NextResponse.json({ error: "admin-only" }, { status: 403 });
  if (pinned) {
    if (m.pinnedAt) return NextResponse.json({ ok: true });
    if ((await prisma.imMessage.count({ where: { roomId: m.roomId, pinnedAt: { not: null }, deletedAt: null } })) >= MAX_PINS) return NextResponse.json({ error: "limit" }, { status: 400 });
    await prisma.imMessage.update({ where: { id: m.id }, data: { pinnedAt: new Date(), pinnedById: me } });
  } else {
    await prisma.imMessage.update({ where: { id: m.id }, data: { pinnedAt: null, pinnedById: null } });
  }
  await prisma.imRoom.update({ where: { id: m.roomId }, data: { pinsAt: new Date() } });
  if (pinned) { const L = await teamLabels([me]); await systemMessage(m.roomId, me, `📌 ${L.get(me)} pripol správu`); }
  return NextResponse.json({ ok: true });
}
