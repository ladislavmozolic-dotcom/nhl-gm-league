import { NextResponse } from "next/server";
import { liveScoreboard } from "@/lib/sim/live-round";

export const dynamic = "force-dynamic";

/** All games of the live round with their score as the viewers have seen it — null when nothing is live. */
export async function GET() {
  return NextResponse.json({ now: Date.now(), live: liveScoreboard() }, { headers: { "Cache-Control": "no-store" } });
}
