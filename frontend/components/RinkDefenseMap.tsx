"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { ZONE_LABEL, type DefenseMap, type Zone } from "@/lib/heatmap-server";

const ANCHOR: Record<Zone, { x: number; y: number }> = {
  NET_FRONT: { x: 100, y: 180 }, SLOT: { x: 100, y: 148 }, CIRCLE: { x: 100, y: 116 }, PERIMETER: { x: 152, y: 118 }, POINT: { x: 100, y: 52 },
};
const MODE_COLOR = { hits: "#f97316", blocks: "#38bdf8", takeaways: "#a78bfa", all: "#f59e0b" } as const;
type Mode = keyof typeof MODE_COLOR;

function Rink({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 200 210" className="w-full max-w-[340px] mx-auto">
      <rect x="4" y="4" width="192" height="202" rx="26" fill="#0b1220" stroke="#1e293b" strokeWidth="2" />
      <line x1="4" y1="46" x2="196" y2="46" stroke="#1d4ed8" strokeWidth="3" opacity="0.6" />
      <circle cx="62" cy="118" r="22" fill="none" stroke="#1e293b" strokeWidth="1.5" />
      <circle cx="138" cy="118" r="22" fill="none" stroke="#1e293b" strokeWidth="1.5" />
      <line x1="20" y1="192" x2="180" y2="192" stroke="#b91c1c" strokeWidth="1.5" opacity="0.7" />
      <path d="M88 192 A12 12 0 0 1 112 192 Z" fill="#1e3a8a" opacity="0.4" stroke="#1d4ed8" strokeWidth="1" />
      {children}
    </svg>
  );
}

export default function RinkDefenseMap({ map }: { map: DefenseMap }) {
  const [mode, setMode] = useState<Mode>("all");
  if (!map) return null;
  const valOf = (c: { hits: number; blocks: number; takeaways: number; total: number }) =>
    mode === "all" ? c.total : mode === "hits" ? c.hits : mode === "blocks" ? c.blocks : c.takeaways;
  const max = Math.max(1, ...map.cells.map(valOf));
  const modes: { id: Mode; label: string }[] = [{ id: "all", label: "All" }, { id: "hits", label: `Hits ${map.hits}` }, { id: "blocks", label: `Blocks ${map.blocks}` }, { id: "takeaways", label: `Takeaways ${map.takeaways}` }];

  return (
    <Card title="Defensive Action Map" accent="text-orange-400">
      <div className="flex flex-wrap gap-2 mb-3">
        {modes.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`px-3 py-1 rounded-md text-xs font-semibold ${mode === m.id ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}>{m.label}</button>
        ))}
      </div>
      <Rink>
        {map.cells.map((c) => {
          const v = valOf(c); if (v <= 0) return null;
          const a = ANCHOR[c.zone]; const r = 9 + Math.sqrt(v / max) * 26; const t = v / max;
          return (
            <g key={c.zone}>
              <circle cx={a.x} cy={a.y} r={r} fill={MODE_COLOR[mode]} fillOpacity={0.25 + t * 0.4} stroke={MODE_COLOR[mode]} strokeOpacity={0.7} strokeWidth={1} />
              <text x={a.x} y={a.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="800" className="fill-white">{v}</text>
            </g>
          );
        })}
      </Rink>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
              <th className="text-left py-1">Zone</th><th className="text-right px-1.5">Hits</th><th className="text-right px-1.5">Blocks</th><th className="text-right pl-1.5">Takeaways</th>
            </tr>
          </thead>
          <tbody>
            {map.cells.map((c) => (
              <tr key={c.zone} className="border-b border-slate-800/50">
                <td className="py-1 text-slate-300">{ZONE_LABEL[c.zone]}</td>
                <td className="text-right px-1.5 tabular-nums">{c.hits}</td>
                <td className="text-right px-1.5 tabular-nums">{c.blocks}</td>
                <td className="text-right pl-1.5 tabular-nums">{c.takeaways}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-600">{map.hits} hits · {map.blocks} blocks · {map.takeaways} takeaways this season · modeled rink-zone distribution (varies by volume &amp; role).</p>
    </Card>
  );
}
