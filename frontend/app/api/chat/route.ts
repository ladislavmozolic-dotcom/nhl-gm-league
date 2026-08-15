import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Recent chat for a channel, newest last, with team code/name/logo joined in.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") || "draft";
  const since = Number(searchParams.get("since")) || 0;

  const msgs = await prisma.chatMessage.findMany({
    where: { channel, ...(since ? { id: { gt: since } } : {}) },
    orderBy: { id: "desc" },
    take: 60,
  });
  const teamIds = [...new Set(msgs.map((m) => m.teamId))];
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, code: true, name: true, logoUrl: true } });
  const t = new Map(teams.map((x) => [x.id, x]));

  const out = msgs.reverse().map((m) => ({
    id: m.id, teamId: m.teamId,
    code: t.get(m.teamId)?.code ?? null, name: t.get(m.teamId)?.name ?? "—", logoUrl: t.get(m.teamId)?.logoUrl ?? null,
    text: m.text, at: m.createdAt.toISOString(),
  }));
  return NextResponse.json({ messages: out });
}
