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

function render(v: number | string | null | undefined, format?: ColFormat): React.ReactNode {
  if (v == null) return "—";
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
  cols: Col[]; rows: Record<string, string | number | null | undefined>[]; initialSort?: string; minWidth?: number;
  /** When two rows tie on the sort column, break the tie with these columns in order — "goals" = more first, "-gp" = fewer first. */
  tieBreaks?: Record<string, string[]>;
  /** Number every row (1, 2, 3 …) in the current sort order, inside the frozen first column. */
  showRank?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: initialSort ?? cols[0].key, dir: -1 });
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(cols.filter((c) => c.defaultHidden).map((c) => c.key)));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");

  const hasPositionCol = cols.some((c) => c.key === "position" || c.key === "pos");
  const isGoalieTable = cols.some((c) => c.key === "svPct" || c.key === "gaa");

  // Filtering
  const filtered = rows.filter((r) => {
    // 1. Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const name = String(r.name ?? "").toLowerCase();
      const team = String(r.teamCode ?? "").toLowerCase();
      if (!name.includes(q) && !team.includes(q)) return false;
    }
    // 2. Position filter (for skater tables)
    if (hasPositionCol && !isGoalieTable && posFilter !== "ALL") {
      const p = String(r.position ?? r.pos ?? "").toUpperCase();
      if (posFilter === "F") return ["C", "LW", "RW", "W", "F", "L", "R"].some((x) => p.includes(x)) && !p.includes("D");
      if (posFilter === "C") return p.includes("C");
      if (posFilter === "W") return p.includes("W") || p.includes("L") || p.includes("R");
      if (posFilter === "D") return p.includes("D");
    }
    return true;
  });

  const visible = cols.filter((c) => !hidden.has(c.key));
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sort.key] ?? "", bv = b[sort.key] ?? "";
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
    <div className="space-y-3">
      {/* Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          {/* Live Search */}
          <div className="relative min-w-[180px] sm:min-w-[240px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter player or team..."
              className="w-full bg-[#0b1120] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all pl-8 shadow-sm"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Position Filters (Skaters only) */}
          {hasPositionCol && !isGoalieTable && (
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-0.5 rounded-xl">
              {[
                { k: "ALL", l: "All" },
                { k: "F", l: "F" },
                { k: "C", l: "C" },
                { k: "W", l: "W" },
                { k: "D", l: "D" },
              ].map((pos) => (
                <button
                  key={pos.k}
                  onClick={() => setPosFilter(pos.k)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    posFilter === pos.k
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  {pos.l}
                </button>
              ))}
            </div>
          )}

          {/* Row count badge */}
          <span className="text-[11px] font-mono text-slate-400 px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-800/80">
            Showing <strong className="text-white font-bold">{sorted.length}</strong> of {rows.length}
          </span>
        </div>

        {/* Column Picker Button */}
        <div className="relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <span>Columns ({visible.length}/{cols.length})</span>
            <span className="text-[10px]">{pickerOpen ? "▴" : "▾"}</span>
          </button>
          {pickerOpen && (
            <div className="absolute right-0 z-30 mt-1.5 w-72 max-h-80 overflow-y-auto bg-[#0b1120] border border-slate-700 rounded-2xl shadow-2xl p-3 grid grid-cols-2 gap-1 backdrop-blur-xl">
              {cols.map((c) => (
                <label
                  key={c.key}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    c.frozen ? "opacity-40" : "cursor-pointer hover:bg-slate-800/70 text-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!hidden.has(c.key)}
                    disabled={c.frozen}
                    onChange={() => toggle(c.key)}
                    className="accent-blue-500 rounded"
                  />
                  <span className="truncate">{c.title ?? c.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#0b1120] border border-slate-800/90 rounded-2xl overflow-x-auto shadow-2xl">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            <tr className="text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-950/80 select-none">
              {visible.map((c) => (
                <th
                  key={c.key}
                  onClick={() => click(c.key)}
                  title={c.title}
                  className={`px-3 py-3 cursor-pointer hover:text-white transition-colors whitespace-nowrap ${
                    c.num ? "text-right" : "text-left"
                  } ${
                    c.frozen
                      ? "sticky left-0 z-20 bg-slate-950 shadow-[2px_0_6px_rgba(0,0,0,0.5)] border-r border-slate-800/80"
                      : ""
                  }`}
                >
                  {showRank && c.frozen && (
                    <span className="inline-block w-6 mr-1.5 text-right text-slate-600 font-mono">#</span>
                  )}
                  {c.label}
                  {c.info && <InfoTip text={c.info} />}
                  <span className="text-blue-400">{arrow(c.key)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {sorted.map((r, i) => (
              <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                {visible.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2.5 ${c.num ? "text-right tabular-nums font-mono text-xs" : ""} ${
                      c.frozen
                        ? "sticky left-0 z-10 bg-[#0b1120] group-hover:bg-[#10192d] shadow-[2px_0_6px_rgba(0,0,0,0.5)] border-r border-slate-800/60 font-semibold"
                        : c.num
                        ? "text-slate-300"
                        : "text-slate-400"
                    }`}
                  >
                    {showRank && c.frozen && (
                      <span className="inline-block w-6 mr-1.5 text-right tabular-nums text-slate-500 font-normal font-mono text-xs">
                        {i + 1}
                      </span>
                    )}
                    {c.team ? (
                      r._teamSlug ? (
                        <Link
                          href={`/teams/${r._teamSlug}`}
                          className="inline-flex items-center gap-1.5 hover:text-blue-400 font-bold transition-colors"
                        >
                          {r._teamLogo && (
                            <img src={String(r._teamLogo)} alt="" className="w-5 h-5 object-contain shrink-0" />
                          )}
                          <span>{render(r[c.key], c.format)}</span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-bold">
                          {r._teamLogo && (
                            <img src={String(r._teamLogo)} alt="" className="w-5 h-5 object-contain shrink-0" />
                          )}
                          <span>{render(r[c.key], c.format)}</span>
                        </span>
                      )
                    ) : c.link && (r._slug || r._pid) != null && (r._slug || r._pid) !== "" ? (
                      <Link
                        href={`/players/${r._slug || r._pid}`}
                        className="hover:text-blue-400 font-bold text-white transition-colors"
                      >
                        {render(r[c.key], c.format)}
                      </Link>
                    ) : (
                      render(r[c.key], c.format)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">
            No matching players or teams found.
          </div>
        )}
      </div>
    </div>
  );
}
