"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cleanName, captaincyFromName } from "@/lib/playerName";

export type RosterPlayer = Record<string, number | string | null> & {
  id: number; name: string; position: string | null; slug?: string | null; age: number | null; overall: number | null; contractText: string | null; condition: number | null;
};

const SKATER_ATTRS = ["ck", "fg", "di", "sk", "st", "en", "du", "ph", "fo", "pa", "sc", "df", "ps", "ex", "ld", "mo"];
const GOALIE_ATTRS = ["sk", "du", "en", "sz", "ag", "rb", "sc", "hs", "rt", "ph", "ps", "ex", "ld", "mo"];

type Col = { key: string; label: string; num: boolean };

export default function RosterTable({ title, players, goalie = false }: { title: string; players: RosterPlayer[]; goalie?: boolean }) {
  const attrs = goalie ? GOALIE_ATTRS : SKATER_ATTRS;
  const cols: Col[] = [
    { key: "name", label: goalie ? "Goalie" : "Player", num: false },
    { key: "position", label: "Pos", num: false },
    { key: "condition", label: "CON", num: true },
    ...attrs.map((a) => ({ key: a, label: a.toUpperCase(), num: true })),
    { key: "overall", label: "OV", num: true },
    { key: "age", label: "Age", num: true },
    { key: "contractText", label: "Contract", num: false },
  ];
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const click = (c: Col) => setSort((s) => (s && s.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: c.num ? -1 : 1 }));

  const rows = useMemo(() => {
    if (!sort) return players;
    const v = (p: RosterPlayer) => sort.key === "name" ? cleanName(p.name).toLowerCase() : p[sort.key];
    return [...players].sort((a, b) => {
      const va = v(a), vb = v(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; if (vb == null) return -1; // blanks last
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sort.dir;
      return String(va).localeCompare(String(vb)) * sort.dir;
    });
  }, [players, sort]);

  const arrow = (k: string) => (sort?.key === k ? (sort.dir === -1 ? " ▾" : " ▴") : "");

  return (
    <div className="mb-6">
      <div className="bg-slate-800/60 border border-slate-700 rounded-t-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-300">{title}</div>
      <div className="bg-slate-900/40 border-x border-b border-slate-800 rounded-b-lg overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 980 }}>
          <thead>
            <tr className="text-[10px] text-slate-500 border-b border-slate-800 bg-slate-800/30 select-none">
              {cols.map((c, i) => (
                <th key={c.key} onClick={() => click(c)} title="Sort"
                  className={`px-2 py-1.5 whitespace-nowrap cursor-pointer hover:text-slate-200 ${sort?.key === c.key ? "text-blue-400" : ""} ${i === 0 ? "text-left sticky left-0 bg-slate-800/40 min-w-[150px]" : i === cols.length - 1 ? "text-right" : "text-center"}`}>{c.label}{arrow(c.key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length} className="px-3 py-3 text-slate-600">no players</td></tr>}
            {rows.map((p) => {
              const cap = captaincyFromName(p.name);
              return (
                <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                  <td className="px-2 py-1.5 text-left sticky left-0 bg-slate-900/60 backdrop-blur whitespace-nowrap">
                    {p.slug ? <Link href={`/players/${p.slug}`} className="hover:text-blue-400 font-medium">{cleanName(p.name)}</Link> : <span className="font-medium">{cleanName(p.name)}</span>}
                    {cap && <span className={`ml-1 text-[9px] font-bold ${cap === "C" ? "text-amber-400" : "text-slate-400"}`}>({cap})</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{p.position ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400 tabular-nums">{p.condition != null ? Number(p.condition).toFixed(0) : "—"}</td>
                  {attrs.map((a) => <td key={a} className="px-2 py-1.5 text-center tabular-nums text-slate-300">{(p[a] as number | null) ?? "—"}</td>)}
                  <td className={`px-2 py-1.5 text-center tabular-nums font-bold ${(p.overall ?? 0) >= 80 ? "text-green-400" : (p.overall ?? 0) >= 70 ? "text-blue-400" : (p.overall ?? 0) >= 60 ? "text-yellow-400" : "text-slate-300"}`}>{p.overall ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400 tabular-nums">{p.age ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right text-slate-400 whitespace-nowrap">{p.contractText ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
