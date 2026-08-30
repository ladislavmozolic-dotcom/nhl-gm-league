// Hit by the server's crontab every 5 minutes (see DEPLOY.md) — a no-op almost every
// time (autoAdvanceIfDue only actually acts inside the 20:30 Europe/Bratislava window,
// once per real day). Protected by a shared secret since it mutates league state
// (plays games, moves money, resolves waivers) with no user session behind it.
import { NextRequest, NextResponse } from "next/server";
import { autoAdvanceIfDue } from "@/lib/season-cron";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // dev-only escape hatch so the 20:30 window can be exercised locally without
  // waiting for the clock — never available in production (NODE_ENV check).
  const nowOverride = process.env.NODE_ENV !== "production" ? req.nextUrl.searchParams.get("now") : null;
  const result = await autoAdvanceIfDue(nowOverride ? new Date(nowOverride) : undefined);
  return NextResponse.json(result);
}
