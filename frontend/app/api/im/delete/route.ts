import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Author can delete their own message; an admin can delete only in the public league
// channel (admins never see or touch private DMs).
export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: number };
  const m = id ? await prisma.imMessage.findUnique({ where: { id }, include: { room: true } }) : null;
  if (!m) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const mine = m.fromTeamId === me;
  const mod = m.room.kind === "league" && (await isAdmin());
  if (!mine && !mod) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await prisma.imMessage.update({ where: { id: m.id }, data: { deletedAt: new Date(), deletedById: me, pinnedAt: null, pinnedById: null } });
  if (m.pinnedAt) await prisma.imRoom.update({ where: { id: m.roomId }, data: { pinsAt: new Date() } });
  return NextResponse.json({ ok: true });
}
