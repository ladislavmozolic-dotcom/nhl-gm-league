import { NextResponse } from "next/server";
import { getTeamSession } from "@/lib/auth";
import { chatEnabled } from "@/lib/im/server";
import { postMessage } from "@/lib/im/post";

export const dynamic = "force-dynamic";

// Create a poll: { roomId | toTeamId, question, options: string[2..10], multi }
export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { roomId?: number; toTeamId?: number; question?: string; options?: string[]; multi?: boolean };
  const r = await postMessage(me, { roomId: b.roomId, toTeamId: b.toTeamId, poll: { question: b.question ?? "", options: Array.isArray(b.options) ? b.options.map(String) : [], multi: !!b.multi } });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, roomId: r.roomId, message: r.message });
}
