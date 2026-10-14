import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Sub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const s = (await req.json().catch(() => ({}))) as Sub;
  if (!s.endpoint || !s.keys?.p256dh || !s.keys?.auth) return NextResponse.json({ error: "bad" }, { status: 400 });
  await prisma.imPushSub.upsert({
    where: { endpoint: s.endpoint }, update: { teamId: me, p256dh: s.keys.p256dh, auth: s.keys.auth },
    create: { teamId: me, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = await getTeamSession();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await prisma.imPushSub.deleteMany({ where: { endpoint, teamId: me } });
  return NextResponse.json({ ok: true });
}
