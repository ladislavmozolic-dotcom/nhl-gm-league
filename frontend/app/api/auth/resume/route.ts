import { NextRequest, NextResponse } from "next/server";
import { resumeTeamSession } from "@/lib/auth";

// Validate expiry, current credentials and session version before restoring.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : null;
  const ok = await resumeTeamSession(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}
