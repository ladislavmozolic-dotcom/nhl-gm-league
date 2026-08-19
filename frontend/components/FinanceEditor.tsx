"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ArenaSection } from "@/lib/finance";

type Props = {
  teamName: string; teamSlug: string; arena: string; sections: ArenaSection[];
  onSave: (slug: string, prices: number[]) => Promise<void>;
};

// tier colour per section level (used for both the stadium bands and the cards)
const TIER: Record<string, string> = {
  "Luxury": "#a855f7", "Level 1": "#2563eb", "Level 2": "#0891b2", "Level 3": "#0d9488", "Level 4": "#64748b",
};
const tierOf = (level: string) => TIER[level] ?? "#64748b";

// Concentric seating bands, premium closest to the ice → cheap seats on the outside.
// Each entry is a nested rounded-rect; the last is the ice sheet. `si` maps the band
// to its index in the `sections` array (data order is L1,L2,L3,L4,Luxury).
const RINGS: { level: string; si: number; x: number; y: number; w: number; h: number; rx: number }[] = [
  { level: "Level 4", si: 3, x: 12, y: 12, w: 416, h: 296, rx: 46 },
  { level: "Level 3", si: 2, x: 36, y: 34, w: 368, h: 252, rx: 40 },
  { level: "Level 2", si: 1, x: 60, y: 56, w: 320, h: 208, rx: 34 },
  { level: "Level 1", si: 0, x: 84, y: 78, w: 272, h: 164, rx: 28 },
  { level: "Luxury", si: 4, x: 108, y: 100, w: 224, h: 120, rx: 22 },
];
const RINK = { x: 132, y: 122, w: 176, h: 76, rx: 20 };
const CX = RINK.x + RINK.w / 2; // 220

export default function FinanceEditor({ teamName, teamSlug, arena, sections, onSave }: Props) {
  const [prices, setPrices] = useState<number[]>(sections.map((s) => s.price));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const setPrice = (i: number, v: number) => {
    setPrices((prev) => prev.map((p, j) => (j === i ? v : p)));
    setSaved(false);
  };
  const totalCap = sections.reduce((t, s) => t + s.capacity, 0);
  const sellout = sections.reduce((t, s, i) => t + s.capacity * (prices[i] ?? s.price), 0);
  const save = () => start(async () => { await onSave(teamSlug, prices); setSaved(true); });

  return (
    <div className="max-w-6xl mx-auto px-4 pb-16">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">{teamName} — Arena &amp; Tickets</h1>
        <div className="flex gap-3 text-sm mt-1">
          <Link href={`/teams/${teamSlug}`} className="text-slate-400 hover:text-blue-400">← team</Link>
          <Link href={`/teams/${teamSlug}/salary`} className="text-slate-400 hover:text-blue-400">Salary Cap →</Link>
          <Link href={`/teams/${teamSlug}/lines`} className="text-slate-400 hover:text-blue-400">Lines →</Link>
        </div>
        <p className="text-sm text-slate-500 mt-1">{arena} · capacity {totalCap.toLocaleString()} · set the price per section — a full house earns the sellout revenue below.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ---- Stadium ---- */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-4 shadow-lg shadow-black/20">
          <svg viewBox="0 0 440 320" className="w-full h-auto" role="img" aria-label="Arena seating map">
            {RINGS.map((r) => {
              const active = hover === r.si;
              const col = tierOf(r.level);
              const nextInner = RINGS[RINGS.indexOf(r) + 1] ?? RINK;
              const labelY = r.y + (nextInner.y - r.y) / 2 + 4;
              return (
                <g key={r.level} onMouseEnter={() => setHover(r.si)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx}
                    fill={col} fillOpacity={active ? 0.55 : 0.32}
                    stroke={col} strokeOpacity={active ? 1 : 0.6} strokeWidth={active ? 2.5 : 1.2} />
                  <text x={CX} y={labelY} textAnchor="middle" fontSize="11.5" fontWeight="700"
                    fill="#fff" style={{ paintOrder: "stroke" }} stroke="#0b1220" strokeWidth="3">
                    {r.level} · ${prices[r.si]}
                  </text>
                </g>
              );
            })}
            {/* ice sheet */}
            <rect x={RINK.x} y={RINK.y} width={RINK.w} height={RINK.h} rx={RINK.rx}
              fill="#eaf3fb" stroke="#c3d7ea" strokeWidth="1.5" />
            {/* rink markings */}
            <line x1={CX} y1={RINK.y} x2={CX} y2={RINK.y + RINK.h} stroke="#e0546b" strokeWidth="1.6" />
            <line x1={RINK.x + RINK.w * 0.34} y1={RINK.y} x2={RINK.x + RINK.w * 0.34} y2={RINK.y + RINK.h} stroke="#5a8fd0" strokeWidth="1.4" />
            <line x1={RINK.x + RINK.w * 0.66} y1={RINK.y} x2={RINK.x + RINK.w * 0.66} y2={RINK.y + RINK.h} stroke="#5a8fd0" strokeWidth="1.4" />
            <circle cx={CX} cy={RINK.y + RINK.h / 2} r="13" fill="none" stroke="#e0546b" strokeWidth="1.3" />
            <circle cx={CX} cy={RINK.y + RINK.h / 2} r="1.6" fill="#e0546b" />
          </svg>
          <p className="text-[11px] text-slate-500 text-center mt-1">Premium seats sit closest to the ice · hover a card to highlight its section</p>
        </div>

        {/* ---- Pricing cards ---- */}
        <div className="space-y-2.5">
          {sections.map((s, i) => {
            const col = tierOf(s.level);
            const rev = s.capacity * (prices[i] ?? 0);
            return (
              <div key={s.level} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                className={`flex items-center gap-3 rounded-xl border bg-slate-900/50 px-4 py-3 transition-colors ${hover === i ? "border-slate-500" : "border-slate-800"}`}>
                <span className="w-2.5 h-9 rounded-full shrink-0" style={{ background: col }} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-100">{s.level}</div>
                  <div className="text-xs text-slate-500">{s.capacity.toLocaleString()} seats · ${rev.toLocaleString()} / game at capacity</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-slate-500">$</span>
                  <input type="number" min={0} max={9999} value={prices[i]}
                    onChange={(e) => setPrice(i, Number(e.target.value))}
                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-right tabular-nums font-medium focus:border-blue-500 outline-none" />
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 mt-1">
            <span className="text-sm font-semibold text-slate-200">Sellout revenue (per game)</span>
            <span className="text-lg font-black tabular-nums text-emerald-400">${sellout.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={save} disabled={pending}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-50">
              {pending ? "Saving…" : "Save ticket prices"}
            </button>
            {saved && <span className="text-green-400 text-sm">✓ Prices saved</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
