import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { chatEnabled, myRoomIds, wire } from "@/lib/im/server";

export const dynamic = "force-dynamic";

// Catch-up for a client whose live stream stalled: messages newer than `after` in my rooms.
export async function GET(req: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const after = Math.max(0, Math.floor(Number(new URL(req.url).searchParams.get("after")) || 0));
  const rows = await prisma.imMessage.findMany({ where: { roomId: { in: await myRoomIds(me) }, id: { gt: after } }, orderBy: { id: "asc" }, take: 200 });
  const latest = rows.length ? rows[rows.length - 1].id : after;
  return NextResponse.json({ messages: await wire(rows), latest });
}
