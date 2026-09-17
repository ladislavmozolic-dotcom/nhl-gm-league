"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

const STYLE_CLASS: Record<string, string> = {
  Offensive: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  Defensive: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Physical: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Balanced: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

const STYLES = ["Offensive", "Defensive", "Physical", "Balanced"];

const ratColor = (v: number) =>
  v >= 90
    ? "text-emerald-400"
    : v >= 82
    ? "text-slate-200"
    : v >= 70
    ? "text-slate-400"
    : "text-slate-500";

type Coach = {
  name: string;
  country: string | null;
  style: string;
  ph: number;
  df: number;
  of: number;
  pd: number;
  ex: number;
  ld: number;
  overall: number;
  age: number | null;
};

type Row = {
  team?: { name: string; slug: string; logoUrl: string | null };
  coach: Coach | null;
};

type SortKey = "of" | "df" | "pd" | "ph" | "ex" | "ld" | "overall" | "age" | "name";

const COLS: { key: "of" | "df" | "pd" | "ph" | "ex" | "ld"; label: string; title: string }[] = [
  { key: "of", label: "OF", title: "Offense — how much the coach boosts offensive play" },
  { key: "df", label: "DF", title: "Defense — how much the coach tightens defensive structure" },
  { key: "pd", label: "PD", title: "Player Discipline — fewer penalties taken by the team" },
  { key: "ph", label: "PH", title: "Physical — emphasis on hitting and physical play" },
  { key: "ex", label: "EX", title: "Experience — steadies the team in clutch moments and late-game situations" },
  { key: "ld", label: "LD", title: "Leadership — motivates players, improves morale and development" },
];

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <span className="relative group/tip cursor-help">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-max max-w-[220px] rounded bg-slate-700 border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 leading-snug shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity text-center">
        {text}
      </span>
    </span>
  );
}

export function CoachesTable({ rows, view }: { rows: Row[]; view: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [styleFilter, setStyleFilter] = useState<string>("all");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    let arr = [...rows];
    if (styleFilter !== "all") {
      arr = arr.filter((r) => r.coach?.style === styleFilter);
    }
    arr.sort((a, b) => {
      const ca = a.coach;
      const cb = b.coach;
      // vacant rows always sink to bottom
      if (!ca && !cb) return 0;
      if (!ca) return 1;
      if (!cb) return -1;

      let va: number | string = 0;
      let vb: number | string = 0;

      if (sortKey === "name") {
        va = (a.team?.name ?? ca.name).toLowerCase();
        vb = (b.team?.name ?? cb.name).toLowerCase();
        return sortDir === "asc"
          ? (va as string).localeCompare(vb as string)
          : (vb as string).localeCompare(va as string);
      } else if (sortKey === "age") {
        va = ca.age ?? -1;
        vb = cb.age ?? -1;
      } else {
        va = ca[sortKey] as number;
        vb = cb[sortKey] as number;
      }

      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [rows, sortKey, sortDir, styleFilter]);

  function SortTh({
    skey,
    children,
    className = "",
    tooltip,
  }: {
    skey: SortKey;
    children: React.ReactNode;
    className?: string;
    tooltip?: string;
  }) {
    const active = sortKey === skey;
    const arrow = active ? (sortDir === "desc" ? " ↓" : " ↑") : "";
    const base = `cursor-pointer select-none hover:text-slate-300 transition-colors ${active ? "text-blue-400" : ""}`;
    const inner = (
      <th
        onClick={() => handleSort(skey)}
        className={`${base} ${className} px-2.5 py-3 font-medium`}
      >
        {children}{arrow}
      </th>
    );
    if (!tooltip) return inner;
    return (
      <th
        onClick={() => handleSort(skey)}
        className={`${base} ${className} px-2.5 py-3 font-medium`}
      >
        <Tooltip text={tooltip}>
          {children}{arrow}
        </Tooltip>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      {/* Style filter pills */}
      <div className="flex gap-2 flex-wrap px-1">
        <button
          onClick={() => setStyleFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${styleFilter === "all" ? "bg-slate-600 border-slate-500 text-white" : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}
        >
          All styles
        </button>
        {STYLES.map((s) => (
          <button
            key={s}
            onClick={() => setStyleFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${styleFilter === s ? STYLE_CLASS[s] + " opacity-100" : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
              <SortTh skey="name" className="text-left px-4">
                {view === "FA" ? "Available Coach" : "Team"}
              </SortTh>
              {view !== "FA" && (
                <th className="text-left px-3 py-3 font-medium text-slate-500">Head Coach</th>
              )}
              <th className="text-left px-3 py-3 font-medium text-slate-500">
                <Tooltip text="Coaching philosophy and game-plan style">Style</Tooltip>
              </th>
              <th className="text-left px-3 py-3 font-medium text-slate-500">
                <Tooltip text="Country of origin">NAT</Tooltip>
              </th>
              {COLS.map((c) => (
                <SortTh key={c.key} skey={c.key} className="text-right" tooltip={c.title}>
                  {c.label}
                </SortTh>
              ))}
              <SortTh skey="overall" className="text-right" tooltip="Overall coach rating">
                OV
              </SortTh>
              <SortTh skey="age" className="text-right px-4" tooltip="Coach age">
                Age
              </SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const c = r.coach;
              return (
                <tr
                  key={r.team?.slug ?? `${c?.name}-${i}`}
                  className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0"
                >
                  {/* Team / Name column */}
                  <td className="px-4 py-3">
                    {r.team ? (
                      <Link
                        href={`/teams/${r.team.slug}`}
                        className="flex items-center gap-2 hover:text-blue-400 transition-colors"
                      >
                        {r.team.logoUrl && (
                          <img src={r.team.logoUrl} alt="" className="w-6 h-6 object-contain" />
                        )}
                        <span className="font-medium">{r.team.name}</span>
                      </Link>
                    ) : (
                      <span className="font-medium">{c?.name ?? "—"}</span>
                    )}
                  </td>

                  {/* Head Coach name (NHL/AHL views only) */}
                  {view !== "FA" && (
                    <td className="px-3 py-3 font-medium">
                      {c?.name ?? <span className="text-slate-600">— vacant —</span>}
                    </td>
                  )}

                  {/* Style badge */}
                  <td className="px-3 py-3">
                    {c ? (
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${STYLE_CLASS[c.style] ?? STYLE_CLASS.Balanced}`}
                      >
                        {c.style}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  {/* Nationality — always visible */}
                  <td className="px-3 py-3 text-slate-400 text-xs">
                    {c?.country ?? <span className="text-slate-600">—</span>}
                  </td>

                  {/* Attribute columns */}
                  {COLS.map((col) => (
                    <td
                      key={col.key}
                      className={`px-2.5 py-3 text-right tabular-nums ${c ? ratColor(c[col.key]) : "text-slate-600"}`}
                    >
                      {c ? c[col.key] : "—"}
                    </td>
                  ))}

                  {/* Overall */}
                  <td
                    className={`px-3 py-3 text-right tabular-nums font-bold ${c ? ratColor(c.overall) : "text-slate-600"}`}
                  >
                    {c?.overall ?? "—"}
                  </td>

                  {/* Age */}
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                    {c?.age ?? <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
