import { NextRequest, NextResponse } from "next/server";
import { getTeamSession } from "@/lib/auth";
import { logAccess } from "@/lib/login-log";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const teamId = await getTeamSession().catch(() => null);
  let path: string | null = null;
  try { path = (await req.json())?.path ?? null; } catch { /* no body */ }
  await logAccess({ type: "visit", teamId, path: typeof path === "string" ? path.slice(0, 120) : null });
  // Team.lastLoginAt used to update ONLY on the login-form submit itself — a GM who
  // stays signed in on their 30-day session cookie (the normal case) could keep
  // playing for days without ever hitting that code path again, leaving "Last
  // login" on /league and /admin/join-requests stuck on their original sign-in
  // date while they were visibly still active (bids, signings, roster moves...).
  // This route already fires once per browser per day for a real registered GM
  // (see logAccess's throttling), so it's a cheap, already-accurate proxy for
  // "still around" — piggyback on it instead of instrumenting every authenticated
  // action separately.
  if (teamId != null) await prisma.team.update({ where: { id: teamId }, data: { lastLoginAt: new Date() } }).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
