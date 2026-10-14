import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { canAccessRoom, chatEnabled, pollInclude, pollWire } from "@/lib/im/server";

export const dynamic = "force-dynamic";

// Vote: { pollId, optionId }  (tap again to withdraw; single-choice polls switch your vote)
// Close: { pollId, close: true }  (poll author only)
export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { pollId?: number; optionId?: number; close?: boolean };
  const poll = b.pollId ? await prisma.imPoll.findUnique({ where: { id: b.pollId }, include: { message: { select: { roomId: true, fromTeamId: true, deletedAt: true } }, options: { select: { id: true } } } }) : null;
  if (!poll || poll.message.deletedAt || !(await canAccessRoom(me, poll.message.roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (b.close) {
    if (poll.message.fromTeamId !== me) return NextResponse.json({ error: "author-only" }, { status: 403 });
    await prisma.imPoll.update({ where: { id: poll.id }, data: { closed: true, updatedAt: new Date() } });
  } else {
    if (poll.closed) return NextResponse.json({ error: "closed" }, { status: 400 });
    if (!b.optionId || !poll.options.some((o) => o.id === b.optionId)) return NextResponse.json({ error: "bad" }, { status: 400 });
    const mine = await prisma.imPollVote.findUnique({ where: { optionId_teamId: { optionId: b.optionId, teamId: me } } });
    if (mine) await prisma.imPollVote.delete({ where: { optionId_teamId: { optionId: b.optionId, teamId: me } } });
    else {
      if (!poll.multi) await prisma.imPollVote.deleteMany({ where: { pollId: poll.id, teamId: me } });
      await prisma.imPollVote.create({ data: { pollId: poll.id, optionId: b.optionId, teamId: me } });
    }
    await prisma.imPoll.update({ where: { id: poll.id }, data: { updatedAt: new Date() } });
  }
  const fresh = await prisma.imPoll.findUnique({ where: { id: poll.id }, include: pollInclude });
  return NextResponse.json({ ok: true, messageId: poll.messageId, poll: fresh ? pollWire(fresh) : null });
}
