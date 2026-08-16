"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { ZONE_LABEL, type HeatMap, type Zone } from "@/lib/heatmap-server";

// anchor point of each danger zone on an offensive half-rink (goal at the bottom)
const ANCHOR: Record<Zone, { x: number; y: number }> = {
  NET_FRONT: { x: 100, y: 180 }, SLOT: { x: 100, y: 148 }, CIRCLE: { x: 100, y: 116 }, PERIMETER: { x: 152, y: 118 }, POINT: { x: 100, y: 52 },
};
const heat = (t: number) => (t > 0.66 ? "#ef4444" : t > 0.33 ? "#f59e0b" : "#38bdf8");

function Rink({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 200 210" className="w-full max-w-[340px] mx-auto">
      {/* ice */}
      <rect x="4" y="4" width="192" height="202" rx="26" fill="#0b1220" stroke="#1e293b" strokeWidth="2" />
      {/* blue line (top) + center hash */}
      <line x1="4" y1="46" x2="196" y2="46" stroke="#1d4ed8" strokeWidth="3" opacity="0.6" />
      {/* faceoff circles */}
      <circle cx="62" cy="118" r="22" fill="none" stroke="#1e293b" strokeWidth="1.5" />
      <circle cx="138" cy="118" r="22" fill="none" stroke="#1e293b" strokeWidth="1.5" />
      <circle cx="62" cy="118" r="2" fill="#334155" /><circle cx="138" cy="118" r="2" fill="#334155" />
      {/* goal line + crease + net (bottom) */}
      <line x1="20" y1="192" x2="180" y2="192" stroke="#b91c1c" strokeWidth="1.5" opacity="0.7" />
      <path d="M88 192 A12 12 0 0 1 112 192 Z" fill="#1e3a8a" opacity="0.4" stroke="#1d4ed8" strokeWidth="1" />
      <rect x="94" y="190" width="12" height="6" fill="none" stroke="#94a3b8" strokeWidth="1" />
      {children}
    </svg>
  );
}

export default function RinkHeatMap({ map }: { map: HeatMap }) {
  const [mode, setMode] = useState<"shots" | "goals">("shots");
  if (!map) return <Card title="Shot Map" accent="text-sky-400"><p className="text-sm text-slate-500 py-4 text-center">No shot-location data yet.</p></Card>;

  const isGoalie = map.kind === "goalie";
  const cells = map.cells as { zone: Zone; shots?: number; goals?: number; faced?: number; saves?: number; shPct?: number; svPct?: number }[];
  const valOf = (c: typeof cells[number]) => isGoalie ? (c.faced ?? 0) : (mode === "shots" ? (c.shots ?? 0) : (c.goals ?? 0));
  const max = Math.max(1, ...cells.map(valOf));

  return (
    <Card title={isGoalie ? "Save Map" : "Shot Map"} accent="text-sky-400">
      {!isGoalie && (
        <div className="flex gap-2 mb-3">
          {(["shots", "goals"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-semibold ${mode === m ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}>
              {m === "shots" ? "Shots" : "Goals"}
            </button>
          ))}
        </div>
      )}

      <Rink>
        {cells.map((c) => {
          const v = valOf(c); if (v <= 0) return null;
          const a = ANCHOR[c.zone];
          const r = 9 + Math.sqrt(v / max) * 26;
          const intensity = v / max;
          return (
            <g key={c.zone}>
              <circle cx={a.x} cy={a.y} r={r} fill={heat(intensity)} fillOpacity={0.28 + intensity * 0.42} stroke={heat(intensity)} strokeOpacity={0.7} strokeWidth={1} />
              <text x={a.x} y={a.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="800" className="fill-white">{v}</text>
            </g>
          );
        })}
      </Rink>

      {/* zone table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
              <th className="text-left py-1">Zone</th>
              {isGoalie ? (<><th className="text-right px-1.5">Faced</th><th className="text-right px-1.5">Saves</th><th className="text-right pl-1.5">SV%</th></>)
                       : (<><th className="text-right px-1.5">Shots</th><th className="text-right px-1.5">Goals</th><th className="text-right pl-1.5">SH%</th></>)}
            </tr>
          </thead>
          <tbody>
            {cells.map((c) => (
              <tr key={c.zone} className="border-b border-slate-800/50">
                <td className="py-1 text-slate-300">{ZONE_LABEL[c.zone]}</td>
                {isGoalie ? (
                  <><td className="text-right px-1.5 tabular-nums">{c.faced}</td><td className="text-right px-1.5 tabular-nums">{c.saves}</td><td className="text-right pl-1.5 tabular-nums text-slate-400">{c.faced ? ((c.svPct ?? 0) * 100).toFixed(1) : "—"}</td></>
                ) : (
                  <><td className="text-right px-1.5 tabular-nums">{c.shots}</td><td className="text-right px-1.5 tabular-nums">{c.goals}</td><td className="text-right pl-1.5 tabular-nums text-slate-400">{c.shots ? ((c.shPct ?? 0) * 100).toFixed(0) + "%" : "—"}</td></>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-600">{isGoalie ? `${map.faced} shots faced · ${(map.svPct * 100).toFixed(1)}% saved` : `${map.total} shots · ${map.goals} goals`} this season · every shot by rink zone (point, perimeter, circle, slot, net-front).</p>
    </Card>
  );
}
