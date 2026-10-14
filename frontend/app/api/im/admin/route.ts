import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Commissioner controls: on/off switch + mute list. No access to private messages.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const s = await prisma.imSettings.findUnique({ where: { id: 1 } });
  const mutes = await prisma.imMute.findMany();
  return NextResponse.json({ enabled: !!s?.enabled, mutes });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; enabled?: boolean; teamId?: number; hours?: number; reason?: string };
  if (b.action === "enable") {
    await prisma.imSettings.upsert({ where: { id: 1 }, update: { enabled: !!b.enabled }, create: { id: 1, enabled: !!b.enabled } });
  } else if (b.action === "mute" && b.teamId) {
    const until = b.hours ? new Date(Date.now() + b.hours * 3600_000) : null;
    await prisma.imMute.upsert({ where: { teamId: b.teamId }, update: { until, reason: b.reason ?? null }, create: { teamId: b.teamId, until, reason: b.reason ?? null } });
  } else if (b.action === "unmute" && b.teamId) {
    await prisma.imMute.delete({ where: { teamId: b.teamId } }).catch(() => {});
  } else return NextResponse.json({ error: "bad" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
