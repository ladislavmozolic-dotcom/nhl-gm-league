"use client";

import { useState } from "react";
import Link from "next/link";
import InfoTip from "@/components/InfoTip";

export type ColFormat = "plusMinus" | "plusDec1" | "pct3" | "pct1" | "dec1" | "dec2" | "minutesClock" | "jersey" | "dash";
export type Col = {
  key: string; label: string; num?: boolean; frozen?: boolean;
  title?: string;         // tooltip (full stat name)
  info?: string;          // richer explainer shown as a click/tap ⓘ in the header
  format?: ColFormat;     // display formatter (serializable); sorting always uses the raw value
  defaultHidden?: boolean; // start hidden — user reveals it via Show / Hide Columns
  link?: boolean;         // render this cell as a player link (uses row._slug ?? row._pid)
  team?: boolean;         // render as team badge: logo (row._teamLogo) + code, linking to /teams/(row._teamSlug)
};

function render(v: number | string, format?: ColFormat): React.ReactNode {
  if (format === "dash") return "—";
  if (format === "jersey") return v ? String(v) : "—";
  const n = Number(v);
  switch (format) {
    case "plusMinus": {
      if (isNaN(n) || n === 0) return <span className="text-slate-400">0</span>;
      if (n > 0) return <span className="text-emerald-400 font-medium">+{n}</span>;
      return <span className="text-rose-400 font-medium">{n}</span>;
    }
    case "plusDec1": {
      if (isNaN(n) || n === 0) return <span className="text-slate-400">0.0</span>;
      if (n > 0) return <span className="text-emerald-400 font-medium">+{n.toFixed(1)}</span>;
      return <span className="text-rose-400 font-medium">{n.toFixed(1)}</span>;
    }
    case "pct3": return n.toFixed(3).replace(/^0/, "");
    case "pct1": return (n * 100).toFixed(1) + "%";
    case "dec1": return n.toFixed(1);
    case "dec2": return n.toFixed(2);
    case "minutesClock": {
      const totalSeconds = Math.max(0, Math.round(n * 60));
      return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
    }
    default: return String(v);
  }
}

export default function StatTable({ cols, rows, initialSort, minWidth = 720, tieBreaks, showRank }: {
  cols: Col[]; rows: Record<string, string | number>[]; initialSort?: string; minWidth?: number;
  /** When two rows tie on the sort column, break the tie with these columns in order — "goals" = more first, "-gp" = fewer first. */
  tieBreaks?: Record<string, string[]>;
  /** Number every row (1, 2, 3 …) in the current sort order, inside the frozen first column. */
  showRank?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: initialSort ?? cols[0].key, dir: -1 });
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(cols.filter((c) => c.defaultHidden).map((c) => c.key)));
  const [pickerOpen, setPickerOpen] = useState(false);

  const visible = cols.filter((c) => !hidden.has(c.key));
  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    const primary = typeof av === "number" && typeof bv === "number" ? (av - bv) * sort.dir : String(av).localeCompare(String(bv)) * sort.dir;
    if (primary !== 0) return primary;
    for (const spec of tieBreaks?.[sort.key] ?? []) {
      const fewerFirst = spec.startsWith("-");
      const k = fewerFirst ? spec.slice(1) : spec;
      const x = a[k], y = b[k];
      if (typeof x !== "number" || typeof y !== "number" || x === y) continue;
      return (fewerFirst ? y - x : x - y) * sort.dir;
    }
    return 0;
  });
  const click = (key: string) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));
  const arrow = (key: string) => (sort.key === key ? (sort.dir === -1 ? " ▾" : " ▴") : "");
  const toggle = (key: string) => setHidden((h) => { const n = new Set(h); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return (
    <div>
      <div className="relative mb-2">
        <button onClick={() => setPickerOpen((o) => !o)}
          className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[13px] font-semibold">
          Show / Hide Columns {pickerOpen ? "▴" : "▾"}
        </button>
        {pickerOpen && (
          <div className="absolute z-20 mt-1 w-64 max-h-72 overflow-y-auto bg-[#0f1d32] border border-slate-700 rounded-lg shadow-2xl p-2 grid grid-cols-2 gap-0.5">
            {cols.map((c) => (
              <label key={c.key} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${c.frozen ? "opacity-40" : "cursor-pointer hover:bg-slate-700/50"}`}>
                <input type="checkbox" checked={!hidden.has(c.key)} disabled={c.frozen}
                  onChange={() => toggle(c.key)} className="accent-blue-500" />
                <span className="truncate">{c.title ?? c.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-800/40">
              {visible.map((c) => (
                <th key={c.key} onClick={() => click(c.key)} title={c.title}
                  className={`px-2.5 py-2.5 cursor-pointer hover:text-slate-200 select-none whitespace-nowrap ${c.num ? "text-right" : "text-left"} ${c.frozen ? "sticky left-0 z-20 bg-slate-900 shadow-[2px_0_4px_rgba(0,0,0,0.3)]" : ""}`}>
                  {showRank && c.frozen && <span className="inline-block w-6 mr-1.5 text-right text-slate-600">#</span>}{c.label}{c.info && <InfoTip text={c.info} />}{arrow(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30 group">
                {visible.map((c) => (
                  <td key={c.key} className={`px-2.5 py-2 ${c.num ? "text-right tabular-nums" : ""} ${c.frozen ? "sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-850 shadow-[2px_0_4px_rgba(0,0,0,0.3)] font-medium" : c.num ? "text-slate-300" : "text-slate-400"}`}>
                    {showRank && c.frozen && <span className="inline-block w-6 mr-1.5 text-right tabular-nums text-slate-500 font-normal">{i + 1}</span>}
                    {c.team ? (
                      r._teamSlug ? (
                        <Link href={`/teams/${r._teamSlug}`} className="inline-flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                          {r._teamLogo && <img src={String(r._teamLogo)} alt="" className="w-5 h-5 object-contain shrink-0" />}
                          <span>{render(r[c.key], c.format)}</span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {r._teamLogo && <img src={String(r._teamLogo)} alt="" className="w-5 h-5 object-contain shrink-0" />}
                          <span>{render(r[c.key], c.format)}</span>
                        </span>
                      )
                    ) : c.link && (r._slug || r._pid) != null && (r._slug || r._pid) !== ""
                      ? <Link href={`/players/${r._slug || r._pid}`} className="hover:text-blue-400 transition-colors">{render(r[c.key], c.format)}</Link>
                      : render(r[c.key], c.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
