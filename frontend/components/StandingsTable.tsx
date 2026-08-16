"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";

export type StandingRow = {
  teamId: number; name: string; gp: number; w: number; l: number; otl: number;
  points: number; gf: number; ga: number; diff: number; logoUrl: string | null; slug: string | null;
};

type ColDef = { key: keyof StandingRow | "team"; label: string; align: "left" | "center"; num?: boolean };
const COLS: ColDef[] = [
  { key: "team", label: "Team", align: "left" },
  { key: "gp", label: "GP", align: "center", num: true },
  { key: "w", label: "W", align: "center", num: true },
  { key: "l", label: "L", align: "center", num: true },
  { key: "otl", label: "OTL", align: "center", num: true },
  { key: "points", label: "PTS", align: "center", num: true },
  { key: "gf", label: "GF", align: "center", num: true },
  { key: "ga", label: "GA", align: "center", num: true },
  { key: "diff", label: "Diff", align: "center", num: true },
];

export default function StandingsTable({ rows }: { rows: StandingRow[] }) {
  // null sort = the natural standings order the server sent (by points).
  const [sort, setSort] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const arr = [...rows].sort((a, b) => {
      const va = a[sort as keyof StandingRow] as number, vb = b[sort as keyof StandingRow] as number;
      return dir === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [rows, sort, dir]);

  const click = (c: ColDef) => {
    if (c.key === "team") return;
    if (sort === c.key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(c.key as string); setDir("desc"); }
  };

  return (
    <Card bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/30 text-slate-500 text-xs uppercase tracking-wider select-none">
              <th className="px-4 py-3 text-left font-medium">#</th>
              {COLS.map((c) => {
                const active = sort === c.key;
                return (
                  <th key={c.key} onClick={() => click(c)}
                    className={`px-3 py-3 font-medium ${c.align === "left" ? "text-left px-4" : "text-center"} ${c.key !== "team" ? "cursor-pointer hover:text-slate-200" : ""} ${active ? "text-blue-400" : ""}`}>
                    {c.label}{active && <span className="ml-0.5 text-[9px]">{dir === "desc" ? "▼" : "▲"}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={t.teamId} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                <td className="px-4 py-2.5 font-bold text-slate-500">{i + 1}</td>
                <td className="px-4 py-2.5">
                  {t.slug ? (
                    <Link href={`/teams/${t.slug}`} className="flex items-center gap-2 min-w-0 hover:text-blue-400 transition-colors">
                      {t.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
                      <span className="font-medium truncate">{t.name}</span>
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 min-w-0">
                      {t.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
                      <span className="font-medium truncate">{t.name}</span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center text-slate-400 tabular-nums">{t.gp}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{t.w}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{t.l}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{t.otl}</td>
                <td className="px-3 py-2.5 text-center font-bold text-white tabular-nums">{t.points}</td>
                <td className="px-3 py-2.5 text-center text-slate-400 tabular-nums">{t.gf}</td>
                <td className="px-3 py-2.5 text-center text-slate-400 tabular-nums">{t.ga}</td>
                <td className={`px-3 py-2.5 text-center tabular-nums ${t.diff > 0 ? "text-green-400" : t.diff < 0 ? "text-red-400" : "text-slate-400"}`}>
                  {t.diff > 0 ? `+${t.diff}` : t.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
