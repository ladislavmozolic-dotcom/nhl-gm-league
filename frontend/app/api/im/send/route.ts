import { NextResponse } from "next/server";
import { getTeamSession } from "@/lib/auth";
import { chatEnabled } from "@/lib/im/server";
import { postMessage, type PostInput } from "@/lib/im/post";

export const dynamic = "force-dynamic";

// Send text / photo / GIF / file to an existing room (roomId) or open a DM with a club (toTeamId).
export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!(await chatEnabled())) return NextResponse.json({ error: "disabled" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as PostInput;
  const r = await postMessage(me, { roomId: b.roomId, toTeamId: b.toTeamId, body: b.body, replyToId: b.replyToId, imageUrl: b.imageUrl, file: b.file, voice: b.voice, mentions: b.mentions, mentionAll: b.mentionAll });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, roomId: r.roomId, message: r.message });
}
