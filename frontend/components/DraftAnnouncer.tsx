"use client";

import { useEffect, useRef, useState } from "react";

type Pick = { pick: number; name: string; club: string | null; teamName: string; teamLogo: string | null };
const ordinal = (n: number) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };

/** Live pick broadcast: polls the latest selection and shows an auto-dismissing
 *  announcement to EVERY viewer. Always the newest pick — if selections come in
 *  faster than the display, it skips straight to the latest (no click backlog). */
export default function DraftAnnouncer({ year }: { year: number }) {
  const [show, setShow] = useState<Pick | null>(null);
  const seen = useRef<number | null>(null); // last pick # we've reacted to
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/draft/last-pick?year=${year}`, { cache: "no-store" });
        const j: Pick & { pick: number } = await r.json();
        if (!alive || !j.pick) return;
        if (seen.current === null) { seen.current = j.pick; return; } // don't replay on load
        if (j.pick > seen.current) {
          seen.current = j.pick;
          setShow(j);                                   // newest pick replaces whatever's up
          if (hideT.current) clearTimeout(hideT.current);
          hideT.current = setTimeout(() => setShow(null), 6000);
        }
      } catch { /* transient */ }
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => { alive = false; clearInterval(t); if (hideT.current) clearTimeout(hideT.current); };
  }, [year]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-black/70 backdrop-blur-sm p-4 animate-[dtFade_0.3s_ease]" onClick={() => setShow(null)}>
      <style>{`@keyframes dtFade{from{opacity:0}to{opacity:1}}@keyframes dtPop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}`}</style>
      <div className="w-full max-w-2xl rounded-3xl border border-amber-500/40 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl p-8 md:p-10 text-center animate-[dtPop_0.35s_ease]">
        {show.teamLogo && <img src={show.teamLogo} alt="" className="w-28 h-28 md:w-32 md:h-32 object-contain mx-auto mb-5 drop-shadow-[0_0_24px_rgba(245,200,66,0.3)]" />}
        <div className="text-sm uppercase tracking-[0.22em] text-amber-400/90">With the {ordinal(show.pick)} overall selection</div>
        <div className="mt-2 text-lg md:text-xl text-slate-300">the <span className="font-bold text-white">{show.teamName}</span> are proud to select</div>
        {show.club && <div className="mt-1 text-sm text-slate-400">from {show.club}</div>}
        <div className="mt-5 text-4xl md:text-6xl font-black text-white">{show.name}</div>
      </div>
    </div>
  );
}
