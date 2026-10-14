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

export async function uploadFile(f: File): Promise<{ url: string; name: string; size: number } | { error: string }> {
  const fd = new FormData(); fd.append("file", f, f.name); fd.append("kind", "file");
  const r = await fetch("/api/im/upload", { method: "POST", body: fd }).catch(() => null);
  if (!r) return { error: "Bez pripojenia — skús znova." };
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { error: (j as { error?: string }).error ?? "Nahranie zlyhalo." };
  return j as { url: string; name: string; size: number };
}

export const fmtSize = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`);
export const fileIcon = (name: string) => {
  const e = name.split(".").pop()?.toLowerCase() ?? "";
  return e === "pdf" ? "📕" : e.startsWith("doc") ? "📘" : e.startsWith("xls") || e === "csv" ? "📗" : e.startsWith("ppt") ? "📙" : e === "zip" ? "🗜️" : "📄";
};

export async function uploadImage(blob: Blob): Promise<{ url: string } | { error: string }> {
  const fd = new FormData(); fd.append("file", blob, "img");
  const r = await fetch("/api/im/upload", { method: "POST", body: fd }).catch(() => null);
  if (!r) return { error: "Bez pripojenia — skús znova." };
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { error: (j as { error?: string }).error === "forbidden" ? "Chat ešte nie je zapnutý alebo si odhlásený." : (j as { error?: string }).error ?? "Nahranie zlyhalo." };
  return { url: (j as { url: string }).url };
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
      const btn = 40;
      const perLine = Math.max(8, Math.min(32, Math.floor((host.current.clientWidth - 24) / btn)));
      const picker = new Picker({
        data: data.default, theme: "dark", locale: "en", previewPosition: "none", skinTonePosition: "search",
        navPosition: "bottom", perLine, maxFrequentRows: 2, emojiButtonSize: btn, emojiSize: 26,
        onEmojiSelect: (e: { native: string }) => onPick(e.native),
      });
      host.current.appendChild(picker as unknown as Node);
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={host} className="w-full [&_em-emoji-picker]:w-full [&_em-emoji-picker]:max-w-none [&_em-emoji-picker]:h-[290px]" />;
}

type Gif = { id: string; preview: string; url: string };
export function GifPicker({ onPick, search, roomId, onUpload }: { onPick: (url: string) => void; search: boolean; roomId: number | null; onUpload: () => void }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[] | null>(null);
  const [own, setOwn] = useState<string[] | null>(null);
  // no Giphy key on the server → show the GIFs already shared in this chat (resend) + upload from device
  useEffect(() => {
    if (search || !roomId) { setOwn([]); return; }
    void fetch(`/api/im/info?roomId=${roomId}&list=gif`).then((r) => r.ok ? r.json() : { items: [] }).then((j) => setOwn([...new Set((j.items as { url: string }[]).map((i) => i.url))].slice(0, 60)));
  }, [search, roomId]);
  useEffect(() => {
    if (!search) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/im/gif?q=${encodeURIComponent(q)}`);
      setGifs(r.ok ? (await r.json()).gifs : []);
    }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, search]);
  if (!search) {
    return (
      <div className="px-4 pb-3">
        <button onClick={onUpload} className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-medium mb-3">⬆︎ Nahrať GIF zo zariadenia</button>
        {own == null && <p className="text-center text-slate-500 text-sm py-4">Načítavam…</p>}
        {own && own.length > 0 && <div className="text-xs text-slate-500 mb-2">GIFy z tohto chatu — ťukni a pošli znova</div>}
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1">
          {own?.map((u) => <button key={u} onClick={() => onPick(u)} className="aspect-square overflow-hidden rounded-lg bg-slate-800"><img src={u} alt="" loading="lazy" className="w-full h-full object-cover" /></button>)}
        </div>
        {own?.length === 0 && <p className="text-center text-slate-500 text-xs py-3">Vyhľadávanie GIFov (GIPHY) sa zapne po nastavení kľúča na serveri. Zatiaľ môžeš nahrať vlastný GIF.</p>}
      </div>
    );
  }
  return (
    <div className="px-4 pb-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hľadať GIF (napr. gól, party)" className="w-full rounded-xl bg-slate-800 px-4 py-2 text-base outline-none mb-2" />
      {gifs == null && <p className="text-center text-slate-500 text-sm py-6">Načítavam…</p>}
      {gifs?.length === 0 && <p className="text-center text-slate-500 text-sm py-6">Nič sa nenašlo</p>}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1">
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

// ── voice messages ─────────────────────────────────────────────────────────────
// Recorded with WebAudio and encoded to 16 kHz mono WAV in the browser, so every phone / desktop can play it
// (MediaRecorder gives webm on Chrome and mp4 on Safari — not interchangeable).
export const VOICE_MAX_SECS = 120;
export type Recorder = { level: () => number; elapsed: () => number; stop: () => Promise<{ blob: Blob; secs: number }>; cancel: () => void };

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  if (ctx.state === "suspended") await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  const t0 = Date.now();
  proc.onaudioprocess = (e) => { chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
  src.connect(analyser); src.connect(proc); proc.connect(ctx.destination); // output stays silent (we never fill it)
  const buf = new Uint8Array(analyser.fftSize);
  const cleanup = () => { try { proc.disconnect(); src.disconnect(); } catch { /* ignore */ } stream.getTracks().forEach((t) => t.stop()); void ctx.close(); };
  return {
    level: () => { analyser.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); return m / 128; },
    elapsed: () => (Date.now() - t0) / 1000,
    cancel: cleanup,
    stop: async () => {
      const rate = ctx.sampleRate; cleanup();
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const all = new Float32Array(total); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
      const OUT = 16000, ratio = rate / OUT, n = Math.floor(total / ratio);
      const pcm = new Int16Array(n);
      for (let i = 0; i < n; i++) { // box-filter downsample
        const a = Math.floor(i * ratio), b = Math.min(total, Math.floor((i + 1) * ratio)); let sum = 0;
        for (let j = a; j < b; j++) sum += all[j];
        const v = Math.max(-1, Math.min(1, sum / Math.max(1, b - a)));
        pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      const wav = new ArrayBuffer(44 + pcm.length * 2), dv = new DataView(wav);
      const w = (off: number, str: string) => { for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i)); };
      w(0, "RIFF"); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVE"); w(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, OUT, true); dv.setUint32(28, OUT * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, pcm.length * 2, true);
      new Int16Array(wav, 44).set(pcm);
      return { blob: new Blob([wav], { type: "audio/wav" }), secs: Math.max(1, Math.round(n / OUT)) };
    },
  };
}

export async function uploadVoice(blob: Blob): Promise<{ url: string } | { error: string }> {
  const fd = new FormData(); fd.append("file", blob, "voice.wav"); fd.append("kind", "voice");
  const r = await fetch("/api/im/upload", { method: "POST", body: fd }).catch(() => null);
  if (!r) return { error: "Bez pripojenia — skús znova." };
  const j = await r.json().catch(() => ({}));
  return r.ok ? { url: (j as { url: string }).url } : { error: (j as { error?: string }).error ?? "Nahranie zlyhalo." };
}

export const fmtSecs = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

let playing: HTMLAudioElement | null = null; // only one voice message plays at a time
export function VoicePlayer({ url, secs }: { url: string; secs: number }) {
  const a = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState(0);
  useEffect(() => () => { a.current?.pause(); }, []);
  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!a.current) {
      const el = new Audio(url);
      el.ontimeupdate = () => setPos(el.currentTime);
      el.onended = () => { setOn(false); setPos(0); };
      el.onpause = () => setOn(false);
      el.onplay = () => setOn(true);
      a.current = el;
    }
    const el = a.current;
    if (el.paused) { if (playing && playing !== el) playing.pause(); playing = el; void el.play(); } else el.pause();
  }
  const dur = a.current && isFinite(a.current.duration) && a.current.duration > 0 ? a.current.duration : secs;
  return (
    <div className="flex items-center gap-3 min-w-[210px] py-1" onClick={(e) => e.stopPropagation()}>
      <button onClick={toggle} aria-label={on ? "Pauza" : "Prehrať"} className="w-10 h-10 shrink-0 rounded-full bg-white/90 text-slate-900 text-base flex items-center justify-center">{on ? "❚❚" : "▶"}</button>
      <div className="flex-1 min-w-0">
        <input type="range" min={0} max={dur || 1} step={0.1} value={pos} onChange={(e) => { const v = Number(e.target.value); setPos(v); if (a.current) a.current.currentTime = v; }} className="w-full h-1 accent-white" aria-label="Pozícia" />
        <div className="text-[11px] opacity-70 mt-0.5">🎤 {fmtSecs(on || pos ? pos : dur)} / {fmtSecs(dur)}</div>
      </div>
    </div>
  );
}
