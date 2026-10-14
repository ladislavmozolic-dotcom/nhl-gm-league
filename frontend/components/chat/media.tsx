"use client";

import { useEffect, useRef, useState } from "react";

/** Downscale a picked image in the browser before upload (GIFs are sent untouched so they keep animating). */
export async function prepareImage(file: File, opts: { max: number; square?: boolean }): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (opts.square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
  const scale = Math.min(1, opts.max / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
  c.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.86));
}

export async function uploadImage(blob: Blob): Promise<string | null> {
  const fd = new FormData(); fd.append("file", blob, "img");
  const r = await fetch("/api/im/upload", { method: "POST", body: fd });
  if (!r.ok) return null;
  return (await r.json()).url as string;
}

/** Full emoji set (emoji-mart, native glyphs, search + skin tones). Loaded lazily so the chat opens fast. */
export function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ Picker }, data] = await Promise.all([import("emoji-mart"), import("@emoji-mart/data")]);
      if (!alive || !host.current) return;
      host.current.innerHTML = "";
      const picker = new Picker({
        data: data.default, theme: "dark", locale: "en", previewPosition: "none", skinTonePosition: "search",
        navPosition: "bottom", perLine: 8, maxFrequentRows: 2, emojiButtonSize: 38, emojiSize: 26,
        onEmojiSelect: (e: { native: string }) => onPick(e.native),
      });
      host.current.appendChild(picker as unknown as Node);
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={host} className="flex justify-center [&_em-emoji-picker]:max-w-full [&_em-emoji-picker]:h-[360px]" />;
}

type Gif = { id: string; preview: string; url: string };
export function GifPicker({ onPick }: { onPick: (url: string) => void }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[] | null>(null);
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch(`/api/im/gif?q=${encodeURIComponent(q)}`);
      setGifs(r.ok ? (await r.json()).gifs : []);
    }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="px-4 pb-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hľadať GIF (napr. gól, party)" className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-base outline-none mb-3" />
      {gifs == null && <p className="text-center text-slate-500 text-sm py-6">Načítavam…</p>}
      {gifs?.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Nič sa nenašlo</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {gifs?.map((g) => <button key={g.id} onClick={() => onPick(g.url)} className="aspect-square overflow-hidden rounded-lg bg-slate-800"><img src={g.preview} alt="" loading="lazy" className="w-full h-full object-cover" /></button>)}
      </div>
      <p className="text-[10px] text-slate-600 text-right mt-2">Powered by GIPHY</p>
    </div>
  );
}

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 bg-black/90 flex items-center justify-center p-3" onClick={onClose}>
      <img src={src} alt="" className="max-w-full max-h-full object-contain" />
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 text-white text-xl" aria-label="Zavrieť">✕</button>
    </div>
  );
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D|\p{Emoji_Modifier})*\s*){1,3}$/u;
export const isBigEmoji = (s: string) => EMOJI_ONLY.test(s.trim());
