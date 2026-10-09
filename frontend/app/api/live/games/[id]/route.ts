import { NextResponse } from "next/server";
import { liveGameView } from "@/lib/sim/live-round";

export const dynamic = "force-dynamic";

/** One live game: score, clock and the events the viewer has reached. `?since=<cursor>` (the previous reply's `cursor`) fetches only the recent tail; repeats are possible — drop them by `seq`. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gameId = Number(id);
  const since = Number(new URL(req.url).searchParams.get("since") ?? -1);
  const view = Number.isInteger(gameId) ? liveGameView(gameId, Number.isFinite(since) ? since : -1) : null;
  if (!view) return NextResponse.json({ error: "That game is not live." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
