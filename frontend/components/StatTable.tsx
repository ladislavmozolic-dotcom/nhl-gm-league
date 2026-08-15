"use client";

import { useState } from "react";

export type ColFormat = "plusMinus" | "plusDec1" | "pct3" | "dec1" | "dec2" | "jersey" | "dash";
export type Col = {
  key: string; label: string; num?: boolean; frozen?: boolean;
  title?: string;         // tooltip (full stat name)
  format?: ColFormat;     // display formatter (serializable); sorting always uses the raw value
  defaultHidden?: boolean; // start hidden — user reveals it via Show / Hide Columns
};

function render(v: number | string, format?: ColFormat): string {
  if (format === "dash") return "—";
  if (format === "jersey") return v ? String(v) : "—";
  const n = Number(v);
  switch (format) {
    case "plusMinus": return n > 0 ? "+" + n : String(n);
    case "plusDec1": return (n > 0 ? "+" : "") + n.toFixed(1);
    case "pct3": return n.toFixed(3).replace(/^0/, "");
    case "dec1": return n.toFixed(1);
    case "dec2": return n.toFixed(2);
    default: return String(v);
  }
}

export default function StatTable({ cols, rows, initialSort, minWidth = 720 }: {
  cols: Col[]; rows: Record<string, string | number>[]; initialSort?: string; minWidth?: number;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: initialSort ?? cols[0].key, dir: -1 });
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(cols.filter((c) => c.defaultHidden).map((c) => c.key)));
  const [pickerOpen, setPickerOpen] = useState(false);

  const visible = cols.filter((c) => !hidden.has(c.key));
  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
    return String(av).localeCompare(String(bv)) * sort.dir;
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
                  className={`px-2.5 py-2.5 cursor-pointer hover:text-slate-200 select-none whitespace-nowrap ${c.num ? "text-right" : "text-left"}`}>
                  {c.label}{arrow(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                {visible.map((c) => (
                  <td key={c.key} className={`px-2.5 py-2 ${c.num ? "text-right tabular-nums" : ""} ${c.frozen ? "font-medium" : c.num ? "text-slate-300" : "text-slate-400"}`}>
                    {render(r[c.key], c.format)}
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
