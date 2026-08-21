import { NextRequest, NextResponse } from "next/server";
import { getTeamSession } from "@/lib/auth";
import { logAccess } from "@/lib/login-log";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const teamId = await getTeamSession().catch(() => null);
  let path: string | null = null;
  try { path = (await req.json())?.path ?? null; } catch { /* no body */ }
  await logAccess({ type: "visit", teamId, path: typeof path === "string" ? path.slice(0, 120) : null });
  return new NextResponse(null, { status: 204 });
}
