import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { chatEnabled } from "@/lib/im/server";

export const dynamic = "force-dynamic";
const MAX_MEMBERS = 40;

async function humanTeamIds(ids: number[]) {
  const t = await prisma.team.findMany({ where: { id: { in: ids }, passwordHash: { not: null } }, select: { id: true } });
  return t.map((x) => x.id);
}

// Create a group: { name, memberIds }
export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { name?: string; memberIds?: number[] };
  const name = (b.name ?? "").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "name" }, { status: 400 });
  const ids = [...new Set([me, ...(await humanTeamIds(b.memberIds ?? []))])].slice(0, MAX_MEMBERS);
  if (ids.length < 2) return NextResponse.json({ error: "members" }, { status: 400 });
  const room = await prisma.imRoom.create({
    data: { kind: "group", name, createdById: me, members: { create: ids.map((teamId) => ({ teamId })) } }, select: { id: true },
  });
  return NextResponse.json({ ok: true, roomId: room.id });
}

// Manage: { roomId, rename?, add?: number[], remove?: number, leave?: true }  (owner manages; anyone may leave)
export async function PATCH(req: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { roomId?: number; rename?: string; add?: number[]; remove?: number; leave?: boolean };
  const room = b.roomId ? await prisma.imRoom.findUnique({ where: { id: b.roomId }, include: { members: true } }) : null;
  if (!room || room.kind !== "group" || !room.members.some((m) => m.teamId === me)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const owner = room.createdById === me;

  if (b.leave) {
    await prisma.imMember.delete({ where: { roomId_teamId: { roomId: room.id, teamId: me } } });
    const rest = room.members.filter((m) => m.teamId !== me).sort((a, c) => a.joinedAt.getTime() - c.joinedAt.getTime());
    if (!rest.length) await prisma.imRoom.delete({ where: { id: room.id } });
    else if (owner) await prisma.imRoom.update({ where: { id: room.id }, data: { createdById: rest[0].teamId } });
    return NextResponse.json({ ok: true });
  }
  if (!owner) return NextResponse.json({ error: "owner-only" }, { status: 403 });
  if (b.rename?.trim()) await prisma.imRoom.update({ where: { id: room.id }, data: { name: b.rename.trim().slice(0, 60) } });
  if (b.add?.length) {
    const have = new Set(room.members.map((m) => m.teamId));
    const add = (await humanTeamIds(b.add)).filter((id) => !have.has(id)).slice(0, MAX_MEMBERS - have.size);
    if (add.length) await prisma.imMember.createMany({ data: add.map((teamId) => ({ roomId: room.id, teamId })), skipDuplicates: true });
  }
  if (b.remove && b.remove !== me) await prisma.imMember.deleteMany({ where: { roomId: room.id, teamId: b.remove } });
  return NextResponse.json({ ok: true });
}
