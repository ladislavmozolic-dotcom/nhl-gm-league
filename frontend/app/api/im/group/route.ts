import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { chatEnabled, isOwnImage, systemMessage, teamLabels } from "@/lib/im/server";

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
  const L = await teamLabels(ids);
  const others = ids.filter((i) => i !== me).map((i) => L.get(i)).join(", ");
  await systemMessage(room.id, me, `${L.get(me)} vytvoril skupinu „${name}“ a pridal: ${others}`);
  return NextResponse.json({ ok: true, roomId: room.id });
}

// Manage: { roomId, rename?, add?: number[], remove?: number, leave?: true }  (owner manages; anyone may leave)
export async function PATCH(req: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { roomId?: number; rename?: string; image?: string | null; add?: number[]; remove?: number; leave?: boolean };
  const room = b.roomId ? await prisma.imRoom.findUnique({ where: { id: b.roomId }, include: { members: true } }) : null;
  if (!room || room.kind !== "group" || !room.members.some((m) => m.teamId === me)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const owner = room.createdById === me;

  const L = await teamLabels([me, ...(b.add ?? []), ...(b.remove ? [b.remove] : [])]);
  if (b.leave) {
    await systemMessage(room.id, me, `${L.get(me)} opustil skupinu`); // written while still a member so remaining members see it
    await prisma.imMember.delete({ where: { roomId_teamId: { roomId: room.id, teamId: me } } });
    const rest = room.members.filter((m) => m.teamId !== me).sort((a, c) => a.joinedAt.getTime() - c.joinedAt.getTime());
    if (!rest.length) await prisma.imRoom.delete({ where: { id: room.id } });
    else if (owner) await prisma.imRoom.update({ where: { id: room.id }, data: { createdById: rest[0].teamId } });
    return NextResponse.json({ ok: true });
  }
  if (!owner) return NextResponse.json({ error: "owner-only" }, { status: 403 });
  if (b.rename?.trim() && b.rename.trim().slice(0, 60) !== room.name) {
    const nn = b.rename.trim().slice(0, 60);
    await prisma.imRoom.update({ where: { id: room.id }, data: { name: nn } });
    await systemMessage(room.id, me, `${L.get(me)} premenoval skupinu na „${nn}“`);
  }
  if (b.image !== undefined && (b.image === null || isOwnImage(b.image))) {
    await prisma.imRoom.update({ where: { id: room.id }, data: { imageUrl: b.image } });
    await systemMessage(room.id, me, b.image ? `${L.get(me)} zmenil obrázok skupiny` : `${L.get(me)} odstránil obrázok skupiny`);
  }
  if (b.add?.length) {
    const have = new Set(room.members.map((m) => m.teamId));
    const add = (await humanTeamIds(b.add)).filter((id) => !have.has(id)).slice(0, MAX_MEMBERS - have.size);
    if (add.length) {
      await prisma.imMember.createMany({ data: add.map((teamId) => ({ roomId: room.id, teamId })), skipDuplicates: true });
      await systemMessage(room.id, me, `${L.get(me)} pridal: ${add.map((i) => L.get(i)).join(", ")}`);
    }
  }
  if (b.remove && b.remove !== me && room.members.some((m) => m.teamId === b.remove)) {
    await systemMessage(room.id, me, `${L.get(me)} odobral: ${L.get(b.remove)}`); // before removal so the removed GM's stream also gets it
    await prisma.imMember.deleteMany({ where: { roomId: room.id, teamId: b.remove } });
  }
  return NextResponse.json({ ok: true });
}
