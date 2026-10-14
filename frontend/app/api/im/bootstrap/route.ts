import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { chatEnabled, leagueRoomId, myRoomIds, wire, isMuted } from "@/lib/im/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getTeamSession();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const admin = await isAdmin();
  const enabled = await chatEnabled();
  if (!enabled && !admin) return NextResponse.json({ error: "disabled" }, { status: 403 });

  const [meTeam, teams, roomIds, league] = await Promise.all([
    prisma.team.findUnique({ where: { id: me }, select: { id: true, code: true, name: true, logoUrl: true, gmNickname: true } }),
    // human-run NHL clubs only (AI-GM clubs have no login → no chat)
    prisma.team.findMany({ where: { league: "NHL", passwordHash: { not: null } }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, logoUrl: true, gmNickname: true } }),
    myRoomIds(me),
    leagueRoomId(),
  ]);
  const profiles = await prisma.imProfile.findMany({ select: { teamId: true, avatarUrl: true } });
  const av = new Map(profiles.map((p) => [p.teamId, p.avatarUrl]));
  const withAv = <T extends { id: number }>(t: T) => ({ ...t, avatarUrl: av.get(t.id) ?? null });
  const rooms = await prisma.imRoom.findMany({ where: { id: { in: roomIds } }, select: { id: true, kind: true, dmKey: true, name: true, imageUrl: true, createdById: true, members: { select: { teamId: true } } } });
  const reads = await prisma.imRead.findMany({ where: { teamId: me, roomId: { in: roomIds } } });
  const readMap = new Map(reads.map((r) => [r.roomId, r.lastReadId]));
  const clearedMap = new Map(reads.map((r) => [r.roomId, r.clearedId]));
  const mutedMap = new Map(reads.map((r) => [r.roomId, r.muted]));

  const out = await Promise.all(rooms.map(async (r) => {
    const cleared = clearedMap.get(r.id) ?? 0;
    const last = await prisma.imMessage.findFirst({ where: { roomId: r.id, id: { gt: cleared } }, orderBy: { id: "desc" } });
    const unread = await prisma.imMessage.count({ where: { roomId: r.id, id: { gt: Math.max(readMap.get(r.id) ?? 0, cleared) }, fromTeamId: { not: me }, deletedAt: null, kind: "user" } });
    let otherTeamId: number | null = null;
    if (r.kind === "dm" && r.dmKey) otherTeamId = r.dmKey.split("-").map(Number).find((x) => x !== me) ?? null;
    const lastW = last ? (await wire([last]))[0] : null;
    return { muted: mutedMap.get(r.id) ?? false, id: r.id, kind: r.kind, otherTeamId, unread, last: lastW, name: r.name, imageUrl: r.imageUrl, createdById: r.createdById, members: r.members.map((m) => m.teamId) };
  }));
  return NextResponse.json({
    me: meTeam ? withAv(meTeam) : meTeam, admin, enabled, muted: await isMuted(me), leagueRoomId: league, teams: teams.map(withAv), rooms: out,
    vapid: process.env.VAPID_PUBLIC_KEY ?? null, gif: !!process.env.GIPHY_API_KEY,
  });
}
