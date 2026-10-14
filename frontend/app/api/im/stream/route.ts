import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { chatEnabled, myRoomIds, wire } from "@/lib/im/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-Sent Events: pushes new / deleted messages for every room I belong to.
// The server polls the DB every 2s per open connection (cheap at league size) and
// closes after ~55s so proxies don't hold stale streams; the client auto-reconnects
// with Last-Event-ID so nothing is missed.
export async function GET(req: Request) {
  const me = await getTeamSession();
  if (!me || !(await chatEnabled())) return new Response("forbidden", { status: 403 });
  const enc = new TextEncoder();
  let cursor = Number(req.headers.get("last-event-id") || new URL(req.url).searchParams.get("after")) || 0;
  if (!cursor) cursor = (await prisma.imMessage.findFirst({ orderBy: { id: "desc" }, select: { id: true } }))?.id ?? 0;
  let delCursor = new Date();
  const peerSeen = new Map<string, number>(); // "roomId:teamId" -> that member's lastReadId, last value sent

  const stream = new ReadableStream({
    async start(controller) {
      const started = Date.now();
      const send = (s: string) => { try { controller.enqueue(enc.encode(s)); } catch { /* closed */ } };
      send("retry: 2000\n\n");
      const tick = async () => {
        try {
          const rooms = await myRoomIds(me);
          const rows = await prisma.imMessage.findMany({ where: { roomId: { in: rooms }, id: { gt: cursor } }, orderBy: { id: "asc" }, take: 100 });
          if (rows.length) {
            cursor = rows[rows.length - 1].id;
            send(`id: ${cursor}\nevent: messages\ndata: ${JSON.stringify(await wire(rows))}\n\n`);
          }
          const dels = await prisma.imMessage.findMany({ where: { roomId: { in: rooms }, deletedAt: { gt: delCursor } }, select: { id: true, roomId: true, deletedAt: true } });
          if (dels.length) {
            delCursor = new Date(Math.max(...dels.map((d) => d.deletedAt!.getTime())));
            send(`event: deleted\ndata: ${JSON.stringify(dels.map((d) => ({ id: d.id, roomId: d.roomId })))}\n\n`);
          } else send(": ping\n\n");
          // peers' read position in my DMs → drives the ✓✓ ticks
          const dmRooms = await prisma.imRoom.findMany({ where: { id: { in: rooms }, kind: { in: ["dm", "group"] } }, select: { id: true } });
          const rr = await prisma.imRead.findMany({ where: { roomId: { in: dmRooms.map((r) => r.id) }, teamId: { not: me } } });
          const changed = rr.filter((r) => peerSeen.get(`${r.roomId}:${r.teamId}`) !== r.lastReadId);
          if (changed.length) {
            changed.forEach((r) => peerSeen.set(`${r.roomId}:${r.teamId}`, r.lastReadId));
            send(`event: reads\ndata: ${JSON.stringify(changed.map((r) => ({ roomId: r.roomId, teamId: r.teamId, lastReadId: r.lastReadId })))}\n\n`);
          }
        } catch { /* transient DB error — next tick retries */ }
      };
      const iv = setInterval(async () => {
        if (Date.now() - started > 55_000) { clearInterval(iv); try { controller.close(); } catch {} return; }
        await tick();
      }, 2000);
      req.signal.addEventListener("abort", () => { clearInterval(iv); try { controller.close(); } catch {} });
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
