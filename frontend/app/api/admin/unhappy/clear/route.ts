import { NextResponse } from "next/server";
import { clearUnhappiness } from "@/lib/unhappy-players-server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ids: number[] = Array.isArray(body.playerIds) ? body.playerIds.map(Number) : [Number(body.playerId)];
    const result = await clearUnhappiness(ids);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Internal server error." }, { status: 500 });
  }
}
