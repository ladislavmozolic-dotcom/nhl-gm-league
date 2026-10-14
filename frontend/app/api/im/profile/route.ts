import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { chatEnabled, isOwnImage } from "@/lib/im/server";

export const dynamic = "force-dynamic";

// My own chat picture: { avatarUrl: "/uploads/chat/…" | null }
export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { avatarUrl } = (await req.json().catch(() => ({}))) as { avatarUrl?: string | null };
  if (avatarUrl != null && !isOwnImage(avatarUrl)) return NextResponse.json({ error: "bad" }, { status: 400 });
  await prisma.imProfile.upsert({ where: { teamId: me }, update: { avatarUrl: avatarUrl ?? null }, create: { teamId: me, avatarUrl: avatarUrl ?? null } });
  return NextResponse.json({ ok: true });
}
