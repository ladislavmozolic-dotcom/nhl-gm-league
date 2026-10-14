// TEMPORARY diagnostic: does a streamed response reach the client progressively through Caddy/Next?
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const identity = new URL(req.url).searchParams.get("enc") === "identity";
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(c) {
      for (let i = 0; i < 6; i++) { c.enqueue(enc.encode(`id: ${i}\nevent: t\ndata: ${Date.now()}\n\n`)); await new Promise((r) => setTimeout(r, 1000)); }
      c.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", ...(identity ? { "Content-Encoding": "identity" } : {}) } });
}
