import { NextResponse } from "next/server";
import { getTeamSession } from "@/lib/auth";
import { chatEnabled } from "@/lib/im/server";

export const dynamic = "force-dynamic";

// GIF search via Giphy — only active when GIPHY_API_KEY is set on the server.
export async function GET(req: Request) {
  const me = await getTeamSession();
  const key = process.env.GIPHY_API_KEY;
  if (!me || !(await chatEnabled()) || !key) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  const url = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13&lang=sk`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=24&rating=pg-13`;
  const r = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!r?.ok) return NextResponse.json({ gifs: [] });
  const j = (await r.json()) as { data?: { id: string; images: { fixed_height_small?: { url: string }; downsized_medium?: { url: string }; original?: { url: string } } }[] };
  const gifs = (j.data ?? []).map((g) => ({ id: g.id, preview: g.images.fixed_height_small?.url, url: g.images.downsized_medium?.url ?? g.images.original?.url })).filter((g) => g.preview && g.url);
  return NextResponse.json({ gifs });
}
