import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, setTeamSession } from "@/lib/auth";

/** Reissues the httpOnly session cookie from the localStorage remember-token
 *  (see components/SessionResume.tsx) — the fallback path for whatever is
 *  making iOS Safari drop the cookie mid-session. Same trust boundary as the
 *  cookie itself: a valid signature is all that's required, no extra DB
 *  check, since a cookie-based session doesn't get one either. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : null;
  const teamId = verifySessionToken(token);
  if (teamId == null) return NextResponse.json({ ok: false }, { status: 401 });
  await setTeamSession(teamId);
  return NextResponse.json({ ok: true });
}
