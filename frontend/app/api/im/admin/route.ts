import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { postTradeTest } from "@/lib/im/trade-post";
import { isOwnImage, leagueRoomId } from "@/lib/im/server";

export const dynamic = "force-dynamic";

// Commissioner controls: on/off switch + mute list. No access to private messages.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const s = await prisma.imSettings.findUnique({ where: { id: 1 } });
  const mutes = await prisma.imMute.findMany();
  // groups the commissioner is a member of (names only — never message content) to pick the trade-announcement chat
  const me = await getTeamSession();
  const groups = me ? await prisma.imRoom.findMany({ where: { kind: "group", members: { some: { teamId: me } } }, select: { id: true, name: true } }) : [];
  return NextResponse.json({ enabled: !!s?.enabled, mutes, tradeRoomId: s?.tradeRoomId ?? null, groups });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; enabled?: boolean; roomId?: number | null; image?: string | null; name?: string; teamId?: number; hours?: number; reason?: string };
  if (b.action === "enable") {
    await prisma.imSettings.upsert({ where: { id: 1 }, update: { enabled: !!b.enabled }, create: { id: 1, enabled: !!b.enabled } });
  } else if (b.action === "tradeRoom") {
    const rid = b.roomId ?? null;
    if (rid != null) {
      const r = await prisma.imRoom.findUnique({ where: { id: rid }, select: { kind: true } });
      if (!r || (r.kind !== "group" && r.kind !== "league")) return NextResponse.json({ error: "bad" }, { status: 400 });
    }
    await prisma.imSettings.upsert({ where: { id: 1 }, update: { tradeRoomId: rid }, create: { id: 1, tradeRoomId: rid } });
  } else if (b.action === "tradeTest") {
    if (!(await postTradeTest())) return NextResponse.json({ error: "no-room" }, { status: 400 });
  } else if (b.action === "leagueName") {
    await prisma.imRoom.update({ where: { id: await leagueRoomId() }, data: { name: (b.name ?? "").trim().slice(0, 40) || null } });
  } else if (b.action === "leagueImage" && (b.image === null || isOwnImage(b.image))) {
    await prisma.imRoom.update({ where: { id: await leagueRoomId() }, data: { imageUrl: b.image } });
  } else if (b.action === "mute" && b.teamId) {
    const until = b.hours ? new Date(Date.now() + b.hours * 3600_000) : null;
    await prisma.imMute.upsert({ where: { teamId: b.teamId }, update: { until, reason: b.reason ?? null }, create: { teamId: b.teamId, until, reason: b.reason ?? null } });
  } else if (b.action === "unmute" && b.teamId) {
    await prisma.imMute.delete({ where: { teamId: b.teamId } }).catch(() => {});
  } else return NextResponse.json({ error: "bad" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
