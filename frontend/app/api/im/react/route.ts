import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { canAccessRoom, chatEnabled, groupReactions } from "@/lib/im/server";

export const dynamic = "force-dynamic";

// React to a message: { id, emoji }  — same emoji again removes it, another emoji replaces it. { id, emoji: null } removes.
export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, emoji } = (await req.json().catch(() => ({}))) as { id?: number; emoji?: string | null };
  const m = id ? await prisma.imMessage.findUnique({ where: { id }, select: { id: true, roomId: true, kind: true, deletedAt: true } }) : null;
  if (!m || m.deletedAt || m.kind === "system" || !(await canAccessRoom(me, m.roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const e = typeof emoji === "string" ? emoji.trim() : "";
  // a single emoji (grapheme cluster), at most ~16 UTF-16 units; anything else is rejected
  if (emoji != null && (!e || e.length > 16 || [...new Intl.Segmenter().segment(e)].length !== 1 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(e))) return NextResponse.json({ error: "bad" }, { status: 400 });
  const cur = await prisma.imReaction.findUnique({ where: { messageId_teamId: { messageId: m.id, teamId: me } } });
  if (!e || cur?.emoji === e) { if (cur) await prisma.imReaction.delete({ where: { messageId_teamId: { messageId: m.id, teamId: me } } }); }
  else await prisma.imReaction.upsert({ where: { messageId_teamId: { messageId: m.id, teamId: me } }, update: { emoji: e }, create: { messageId: m.id, teamId: me, emoji: e } });
  await prisma.imMessage.update({ where: { id: m.id }, data: { reactedAt: new Date() } });
  const rs = await prisma.imReaction.findMany({ where: { messageId: m.id }, select: { emoji: true, teamId: true } });
  return NextResponse.json({ ok: true, messageId: m.id, reactions: groupReactions(rs) });
}
