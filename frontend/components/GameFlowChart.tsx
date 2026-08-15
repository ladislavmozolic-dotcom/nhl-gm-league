"use client";

import { useState } from "react";
import type { GameFlow } from "@/lib/game-report-server";

const W = 1000, H = 240, padL = 54, padR = 16, padT = 16, padB = 26;
const plotW = W - padL - padR, plotH = H - padT - padB;
const mid = padT + plotH / 2;

export default function GameFlowChart({ flow }: { flow: GameFlow }) {
  const [sel, setSel] = useState<number | null>(null);
  const totalSec = flow.bins.length ? flow.bins[flow.bins.length - 1].endSec : 3600;
  const xOf = (t: number) => padL + (Math.min(t, totalSec) / totalSec) * plotW;
  const yOf = (d: number) => mid - (d / flow.maxAbs) * (plotH / 2);

  const line = flow.points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)},${yOf(p.diff).toFixed(1)}`).join(" ");
  const area = `${line} L${xOf(totalSec).toFixed(1)},${mid} L${xOf(0).toFixed(1)},${mid} Z`;
  const periodLines = [1200, 2400].concat(totalSec > 3600 ? [3600] : []).filter((t) => t < totalSec);
  const bin = sel != null ? flow.bins[sel] : null;
  const binMax = bin ? Math.max(0.3, bin.homeXg, bin.awayXg) : 1;

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Game Flow · xG</span>
        <span className="text-[11px] text-slate-500">click a 5-min window for the detail</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
        {/* advantage labels */}
        <text x={6} y={padT + 10} className="fill-sky-400" fontSize={12} fontWeight="700">{flow.homeCode} ▲</text>
        <text x={6} y={padT + plotH - 2} className="fill-rose-400" fontSize={12} fontWeight="700">{flow.awayCode} ▼</text>
        {/* midline + period dividers */}
        <line x1={padL} y1={mid} x2={W - padR} y2={mid} stroke="#475569" strokeWidth={1} />
        {periodLines.map((t) => <line key={t} x1={xOf(t)} y1={padT} x2={xOf(t)} y2={padT + plotH} stroke="#1e293b" strokeWidth={1} strokeDasharray="3 3" />)}
        {[0, 1, 2].map((i) => <text key={i} x={xOf(i * 1200 + 600)} y={H - 8} textAnchor="middle" className="fill-slate-600" fontSize={11}>{`${i + 1}${["st", "nd", "rd"][i]}`}</text>)}
        {totalSec > 3600 && <text x={xOf(3600 + 300)} y={H - 8} textAnchor="middle" className="fill-slate-600" fontSize={11}>OT</text>}

        {/* advantage area + line */}
        <path d={area} fill="url(#flowgrad)" opacity={0.5} />
        <defs>
          <linearGradient id="flowgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#fb7185" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#fb7185" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <path d={line} fill="none" stroke="#e2e8f0" strokeWidth={2} strokeLinejoin="round" />

        {/* goal markers */}
        {flow.goals.map((g, i) => (
          <g key={i}>
            <circle cx={xOf(g.t)} cy={g.home ? padT + 6 : padT + plotH - 6} r={4} fill={g.home ? "#38bdf8" : "#fb7185"} stroke="#0f172a" strokeWidth={1} />
          </g>
        ))}

        {/* clickable bins */}
        {flow.bins.map((b, i) => (
          <rect key={i} x={xOf(b.startSec)} y={padT} width={xOf(b.endSec) - xOf(b.startSec)} height={plotH}
            fill={sel === i ? "#ffffff" : "transparent"} fillOpacity={sel === i ? 0.06 : 0}
            stroke={sel === i ? "#64748b" : "transparent"} strokeWidth={1}
            className="cursor-pointer" onClick={() => setSel(sel === i ? null : i)}>
            <title>{b.label}: {flow.homeCode} {b.homeXg} xG · {flow.awayCode} {b.awayXg} xG</title>
          </rect>
        ))}
      </svg>

      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
        <span>Total xG — <span className="text-sky-400">{flow.homeCode} {flow.homeXg}</span> · <span className="text-rose-400">{flow.awayCode} {flow.awayXg}</span></span>
        <span className="text-slate-600">🔵 {flow.homeCode} goal · 🔴 {flow.awayCode} goal</span>
      </div>

      {/* selected window detail */}
      {bin && (
        <div className="mt-3 rounded-lg bg-slate-950/50 border border-slate-800 p-3">
          <div className="text-xs font-bold text-slate-300 mb-2">{bin.label} <span className="text-slate-500 font-normal">— scoring chances (xG)</span></div>
          <div className="space-y-1.5 mb-2">
            <div className="flex items-center gap-2 text-xs"><span className="w-10 text-sky-400 shrink-0">{flow.homeCode}</span><div className="flex-1 h-3 bg-slate-800 rounded overflow-hidden"><div className="h-full bg-sky-500" style={{ width: `${(bin.homeXg / binMax) * 100}%` }} /></div><span className="w-10 text-right tabular-nums text-slate-300">{bin.homeXg}</span></div>
            <div className="flex items-center gap-2 text-xs"><span className="w-10 text-rose-400 shrink-0">{flow.awayCode}</span><div className="flex-1 h-3 bg-slate-800 rounded overflow-hidden"><div className="h-full bg-rose-500" style={{ width: `${(bin.awayXg / binMax) * 100}%` }} /></div><span className="w-10 text-right tabular-nums text-slate-300">{bin.awayXg}</span></div>
          </div>
          {bin.plays.length > 0 ? (
            <ul className="space-y-0.5 text-xs text-slate-400">{bin.plays.map((p, i) => <li key={i}>{p}</li>)}</ul>
          ) : <p className="text-xs text-slate-600">No goals or big saves in this window.</p>}
        </div>
      )}
    </div>
  );
}
