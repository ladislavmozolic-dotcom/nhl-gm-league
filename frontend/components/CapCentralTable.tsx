"use client";

import { useState } from "react";
import Link from "next/link";
import { money } from "@/lib/finance";

export type CapRow = {
  id: number; name: string; slug: string; logoUrl: string | null; gp: number; gamesTotal: number;
  count: number; totalSalaries: number; buyouts: number; deadCap: number;
  capHit: number; capSpace: number; projCapHit: number; projCapSpace: number;
  underFloorBy: number;
};

type Col = { key: keyof CapRow; label: string; money?: boolean; space?: boolean; title?: string };
const COLS: Col[] = [
  { key: "count", label: "Players in Salary Cap" },
  { key: "totalSalaries", label: "Total Salaries", money: true, title: "Sum of each player's Cap Hit — already net of any retention someone else pays" },
  { key: "buyouts", label: "Buyouts", money: true, title: "Dead money from this club's own player buyouts" },
  { key: "deadCap", label: "Dead Cap", money: true, title: "Salary this club retains on players it traded away — not a buyout, but still counts against its cap" },
  { key: "capHit", label: "Actual Cap Hit", money: true, title: "Total Salaries + Buyouts + Dead Cap" },
  { key: "capSpace", label: "Actual Cap Space", money: true, space: true, title: "Upper ceiling − Actual Cap Hit (can be negative)" },
  { key: "projCapHit", label: "Projected Cap Hit", money: true, title: "Max total cap hit you may carry for the rest of the season" },
  { key: "projCapSpace", label: "Projected Cap Space", money: true, space: true, title: "The biggest full-season cap hit you can still add and stay legal — unused cap banks each game, so it grows toward the deadline." },
];

export default function CapCentralTable({ rows }: { rows: CapRow[] }) {
  const [sort, setSort] = useState<{ key: keyof CapRow; dir: 1 | -1 }>({ key: "capHit", dir: -1 });
  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
    return String(av).localeCompare(String(bv)) * sort.dir;
  });
  const click = (key: keyof CapRow) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));
  const arrow = (key: keyof CapRow) => (sort.key === key ? (sort.dir === -1 ? " ▾" : " ▴") : "");

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto">
      <table className="w-full text-sm min-w-[1000px]">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-800/40">
            <th onClick={() => click("name")} className="text-left px-4 py-2.5 cursor-pointer hover:text-slate-200 select-none">Team{arrow("name")}</th>
            {COLS.map((c) => (
              <th key={c.key} onClick={() => click(c.key)} title={c.title} className="text-right px-3 py-2.5 cursor-pointer hover:text-slate-200 select-none whitespace-nowrap">{c.label}{arrow(c.key)}</th>
            ))}
            <th onClick={() => click("underFloorBy")} title="Over the upper limit, below the lower limit (floor), or compliant" className="text-right px-3 py-2.5 cursor-pointer hover:text-slate-200 select-none whitespace-nowrap">Cap Status{arrow("underFloorBy")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
              <td className="px-4 py-2.5">
                <Link href={`/finance/${t.slug}`} className="flex items-center gap-2 hover:text-blue-400">
                  {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                  <span className="font-medium">{t.name}</span>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{t.count}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(t.totalSalaries)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{t.buyouts ? money(t.buyouts) : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{t.deadCap ? money(t.deadCap) : "—"}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${t.capSpace < 0 ? "text-red-400" : ""}`}>{money(t.capHit)}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums ${t.capSpace < 0 ? "text-red-400" : "text-green-400"}`}>{money(t.capSpace)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{money(t.projCapHit)}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${t.projCapSpace < 0 ? "text-red-400" : "text-emerald-400"}`}>{money(t.projCapSpace)}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {t.capSpace < 0 ? (
                  <span className="text-red-400 font-semibold">Over ceiling {money(-t.capSpace)}</span>
                ) : t.underFloorBy > 0 ? (
                  <span className="text-amber-400 font-semibold">Below floor {money(t.underFloorBy)}</span>
                ) : (
                  <span className="text-emerald-500/80">Compliant ✓</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
