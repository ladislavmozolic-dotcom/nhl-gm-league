import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { canAccessRoom, chatEnabled } from "@/lib/im/server";

export const dynamic = "force-dynamic";

const URL_RE = /https?:\/\/[^\s<>"']+/i;
const isGif = (u: string) => /\.gif(\?|$)/i.test(u) || /giphy\.com/i.test(u);

// Viber-style "Info" panel data: counts + previews of shared photos / GIFs / links, and the mute flag.
// With ?list=media|gif|links it returns the full list (newest first, up to 300).
export async function GET(req: Request) {
  const me = await getTeamSession();
  const sp = new URL(req.url).searchParams;
  const roomId = Number(sp.get("roomId"));
  if (!me || !roomId || !(await chatEnabled()) || !(await canAccessRoom(me, roomId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rd = await prisma.imRead.findUnique({ where: { roomId_teamId: { roomId, teamId: me } }, select: { clearedId: true, muted: true } });
  const after = rd?.clearedId ?? 0;
  const rows = await prisma.imMessage.findMany({
    where: { roomId, id: { gt: after }, deletedAt: null, kind: { not: "system" }, OR: [{ imageUrl: { not: null } }, { fileUrl: { not: null } }, { body: { contains: "http" } }] },
    orderBy: { id: "desc" }, take: 600, select: { id: true, fromTeamId: true, body: true, imageUrl: true, fileUrl: true, fileName: true, fileSize: true, createdAt: true },
  });
  const media = rows.filter((r) => r.imageUrl && !isGif(r.imageUrl)).map((r) => ({ id: r.id, url: r.imageUrl!, at: r.createdAt.toISOString(), from: r.fromTeamId }));
  const gifs = rows.filter((r) => r.imageUrl && isGif(r.imageUrl)).map((r) => ({ id: r.id, url: r.imageUrl!, at: r.createdAt.toISOString(), from: r.fromTeamId }));
  const links = rows.flatMap((r) => { const m = r.body.match(URL_RE); return m ? [{ id: r.id, url: m[0], at: r.createdAt.toISOString(), from: r.fromTeamId }] : []; });
  const files = rows.filter((r) => r.fileUrl).map((r) => ({ id: r.id, url: r.fileUrl!, name: r.fileName ?? "súbor", size: r.fileSize ?? 0, at: r.createdAt.toISOString(), from: r.fromTeamId }));
  const list = sp.get("list");
  if (list === "files") return NextResponse.json({ items: files.slice(0, 300) });
  if (list === "media") return NextResponse.json({ items: media.slice(0, 300) });
  if (list === "gif") return NextResponse.json({ items: gifs.slice(0, 300) });
  if (list === "links") return NextResponse.json({ items: links.slice(0, 300) });
  return NextResponse.json({ muted: !!rd?.muted, counts: { media: media.length, gif: gifs.length, links: links.length, files: files.length }, preview: media.slice(0, 12) });
}
