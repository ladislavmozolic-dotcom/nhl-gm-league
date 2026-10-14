import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { MAX_LEN, chatEnabled, wire } from "@/lib/im/server";

export const dynamic = "force-dynamic";
const EDIT_WINDOW_MS = 48 * 3600_000;

// Author edits the text of their own message (within 48 h). Shown as "upravené".
export async function POST(req: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, body } = (await req.json().catch(() => ({}))) as { id?: number; body?: string };
  const text = (body ?? "").trim().slice(0, MAX_LEN);
  const m = id ? await prisma.imMessage.findUnique({ where: { id } }) : null;
  if (!m || m.fromTeamId !== me || m.kind !== "user" || m.deletedAt) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!text && !m.imageUrl) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (Date.now() - m.createdAt.getTime() > EDIT_WINDOW_MS) return NextResponse.json({ error: "too-old" }, { status: 400 });
  if (text === m.body) return NextResponse.json({ ok: true, message: (await wire([m]))[0] });
  const u = await prisma.imMessage.update({ where: { id: m.id }, data: { body: text, editedAt: new Date() } });
  return NextResponse.json({ ok: true, message: (await wire([u]))[0] });
}
