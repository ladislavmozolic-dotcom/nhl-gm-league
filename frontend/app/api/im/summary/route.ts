import { NextResponse } from "next/server";
import { getTeamSession } from "@/lib/auth";
import { canAccessRoom, chatEnabled } from "@/lib/im/server";
import { summarizeUnread } from "@/lib/im/summary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// "Summarize what I missed": { roomId, afterId } → summary of other GMs' messages after afterId.
// Never marks anything read and never exposes other rooms.
export async function POST(req: Request) {
  const me = await getTeamSession();
  const { roomId, afterId } = (await req.json().catch(() => ({}))) as { roomId?: number; afterId?: number };
  if (!me || !roomId || !(await chatEnabled()) || !(await canAccessRoom(me, roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await summarizeUnread(me, roomId, Math.max(0, Math.floor(Number(afterId) || 0))));
}
