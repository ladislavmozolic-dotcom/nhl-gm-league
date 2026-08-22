"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";
import { posGroup, ratingColor, ovColor } from "@/lib/ratingBands";

const parseCap = (t: string | null) => { if (!t) return 0; const m = t.match(/[\d,]+/); return m ? parseInt(m[0].replace(/,/g, ""), 10) : 0; };
const salaryOf = (p: any) => p.capHit || parseCap(p.contractText);
const fmtM = (v: number) => (v > 0 ? `$${(v / 1_000_000).toFixed(2)}M` : "—");

type Col = { key: string; label: string; num: boolean };

/** The interactive (click-to-sort) roster table body for one section. */
export default function RosterRows({ players, attrs, isGoalie, farm }: { players: any[]; attrs: string[]; isGoalie: boolean; farm?: boolean }) {
  const cols: Col[] = [
    { key: "name", label: "Player", num: false },
    { key: "position", label: "Pos", num: false },
    { key: "age", label: "Age", num: true },
    { key: "condition", label: "CON", num: true },
    ...attrs.map((a) => ({ key: a, label: a.toUpperCase(), num: true })),
    { key: "overall", label: "OVR", num: true },
    { key: "salary", label: "Salary", num: true },
  ];
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const click = (c: Col) => setSort((s) => (s && s.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: c.num ? -1 : 1 }));
  const val = (p: any, k: string) => k === "name" ? cleanName(p.name).toLowerCase() : k === "salary" ? salaryOf(p) : p[k];

  const rows = useMemo(() => {
    if (!sort) return players;
    return [...players].sort((a, b) => {
      const va = val(a, sort.key), vb = val(b, sort.key);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sort.dir;
      return String(va).localeCompare(String(vb)) * sort.dir;
    });
  }, [players, sort]);
  const arrow = (k: string) => (sort?.key === k ? (sort.dir === -1 ? " ▾" : " ▴") : "");
  const thBase = "px-3 py-3 font-medium cursor-pointer hover:text-slate-200 select-none";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-wider bg-slate-800/30">
            {cols.map((c, i) => (
              <th key={c.key} onClick={() => click(c)} title="Sort"
                className={`${thBase} ${sort?.key === c.key ? "text-blue-400" : ""} ${i === 0 ? "text-left sticky left-0 bg-slate-900 z-10 min-w-[160px]" : c.key === "salary" ? "text-right" : "text-center"} ${c.num && c.key !== "salary" ? "w-11" : ""}`}>
                {c.label}{arrow(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((player) => {
            const salary = salaryOf(player);
            const grp = isGoalie ? ("G" as const) : posGroup(player.position, false);
            return (
              <tr key={player.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                <td className="px-3 py-2 sticky left-0 bg-slate-900 z-10">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar src={player.photoUrl} alt={player.name} size={32} />
                    <div className="min-w-0">
                      <Link href={`/players/${player.slug}`} className="font-medium text-sm text-white hover:text-blue-400 transition-colors truncate block">
                        {cleanName(player.name)}
                        {(player.capRole ?? player.captaincy) && <span className={`ml-1 text-[10px] font-bold ${(player.capRole ?? player.captaincy) === "C" ? "text-amber-400" : "text-slate-400"}`}>({player.capRole ?? player.captaincy})</span>}
                      </Link>
                      {farm && player.affiliate && <p className="text-[10px] text-emerald-300/60">{player.affiliate.code || player.affiliate.name}</p>}
                      {(player.injuryDaysLeft ?? 0) > 0 && (
                        <p className="text-[10px] font-semibold text-red-400 flex items-center gap-1 whitespace-nowrap" title={player.injuryDesc || "Injured"}>
                          <span aria-hidden>🤕</span> IR · {player.injuryDaysLeft}d{player.injuryDesc ? ` · ${player.injuryDesc}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center text-slate-400 whitespace-nowrap">{player.position}</td>
                <td className="px-3 py-2.5 text-center text-slate-400">{player.age || "—"}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">
                  {(() => {
                    const con = player.condition;
                    if (con == null) return <span className="text-slate-600">—</span>;
                    const c = con >= 92 ? "text-emerald-400" : con >= 80 ? "text-green-400" : con >= 65 ? "text-amber-400" : "text-red-400";
                    return <span className={`font-semibold ${c}`}>{con.toFixed(2).replace(".", ",")}</span>;
                  })()}
                </td>
                {attrs.map((a) => <td key={a} className={`px-2.5 py-2.5 text-center tabular-nums ${ratingColor(grp, a, player[a])}`}>{player[a] ?? "—"}</td>)}
                <td className="px-2 py-2 text-center"><span className={`font-bold ${ovColor(grp, player.overall)}`}>{player.overall || "—"}</span></td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <span className={`font-semibold tabular-nums ${salary > 0 ? "text-white" : "text-slate-600"}`}>{fmtM(salary)}</span>
                  {(() => { const yr = player.contractText?.match(/(\d+)\s*yr/i)?.[1]; return yr ? <p className="text-[10px] text-slate-500 tabular-nums">{yr} {yr === "1" ? "year" : "years"}</p> : null; })()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
