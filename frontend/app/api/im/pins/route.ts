import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { canAccessRoom, chatEnabled, wire } from "@/lib/im/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await getTeamSession();
  const roomId = Number(new URL(req.url).searchParams.get("roomId"));
  if (!me || !roomId || !(await chatEnabled()) || !(await canAccessRoom(me, roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rows = await prisma.imMessage.findMany({ where: { roomId, pinnedAt: { not: null }, deletedAt: null }, orderBy: { pinnedAt: "desc" }, take: 10 });
  return NextResponse.json({ pins: await wire(rows) });
}
