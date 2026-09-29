import { NextRequest, NextResponse } from "next/server";
import { runFullWorldSync } from "@/lib/world-sync";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const param = req.nextUrl.searchParams.get("secret");
  if (param === secret) return true;
  return false;
}

/**
 * Daily Around the World refresh endpoint.
 * Can be called by:
 * - Server crontab via curl POST /api/cron/world-leagues -H "Authorization: Bearer <CRON_SECRET>"
 * - External HTTP cron service via GET/POST /api/cron/world-leagues?secret=<CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runFullWorldSync();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Cron WorldLeagues] Full world sync failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "World sync failed." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

