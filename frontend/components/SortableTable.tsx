"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";
import InterestButton, { type InterestCtx } from "@/components/InterestButton";

export type ColKind = "player" | "team" | "num" | "money" | "ovr" | "years" | "text" | "ext" | "interest";
export type SortCol = { key: string; label: string; kind?: ColKind; title?: string; sticky?: boolean };
export type SortRow = Record<string, any>;

const numeric = (k?: ColKind) => k === "num" || k === "money" || k === "ovr" || k === "years";
const money = (v: number) => (v > 0 ? `$${(v / 1_000_000).toFixed(2)}M` : "—");
const ovrColor = (v: number) => (v >= 80 ? "text-green-400" : v >= 70 ? "text-blue-400" : v >= 60 ? "text-yellow-400" : "text-slate-400");

function sortVal(row: SortRow, c: SortCol) {
  if (c.kind === "player" || c.kind === "ext") return (row.name ?? "").toString().toLowerCase();
  if (c.kind === "team") return (row.teamCode ?? "").toString().toLowerCase();
  if (numeric(c.kind)) return Number(row[c.key] ?? -Infinity);
  return (row[c.key] ?? "").toString().toLowerCase();
}

/**
 * Client table with click-to-sort headers. Keeps player avatars/links and team
 * logos while letting any column sort in one click (numeric desc / text asc,
 * toggling on repeat click).
 */
export default function SortableTable({ cols, rows, initialSort, minWidth = 720, interestCtx }: {
  cols: SortCol[]; rows: SortRow[]; initialSort?: string; minWidth?: number; interestCtx?: InterestCtx;
}) {
  const [sort, setSort] = useState<string | null>(initialSort ?? null);
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [q, setQ] = useState("");

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const c = cols.find((x) => x.key === sort);
    if (!c) return rows;
    const arr = [...rows].sort((a, b) => {
      const va = sortVal(a, c), vb = sortVal(b, c);
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, cols, sort, dir]);

  const onHeader = (c: SortCol) => {
    if (sort === c.key) { setDir((d) => (d === "desc" ? "asc" : "desc")); }
    else { setSort(c.key); setDir(numeric(c.kind) ? "desc" : "asc"); }
  };

  const align = (c: SortCol) => (c.kind === "player" ? "text-left" : c.kind === "money" || c.kind === "years" ? "text-right" : "text-center");

  const query = q.trim().toLowerCase();
  const filtered = query ? sorted.filter((r) => (r.name ?? "").toString().toLowerCase().includes(query)) : sorted;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div className="relative">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search player…"
            className="w-56 max-w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
        </div>
        {query && <span className="text-xs text-slate-500">{filtered.length} match{filtered.length === 1 ? "" : "es"}</span>}
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-[11px] uppercase tracking-wider select-none">
            {cols.map((c) => {
              const active = sort === c.key;
              return (
                <th key={c.key} title={c.title}
                  className={`px-3 py-3 font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap ${align(c)} ${c.sticky ? "sticky left-0 bg-slate-900 z-10 min-w-[160px]" : ""} ${active ? "text-blue-400" : ""}`}
                  onClick={() => onHeader(c)}>
                  {c.label}
                  <span className="ml-0.5 inline-block w-2 text-[9px]">{active ? (dir === "desc" ? "▼" : "▲") : ""}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, i) => (
            <tr key={row._id ?? i} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
              {cols.map((c) => {
                const base = `px-3 py-2 ${align(c)}`;
                if (c.kind === "player") {
                  return (
                    <td key={c.key} className={`${base} ${c.sticky ? "sticky left-0 bg-slate-900 z-10" : ""}`}>
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar src={row.photo ?? null} alt={row.name ?? ""} size={30} />
                        {row.slug
                          ? <Link href={`/players/${row.slug}`} className="font-medium hover:text-blue-400 transition-colors truncate block">{cleanName(row.name ?? "")}</Link>
                          : <span className="font-medium truncate">{cleanName(row.name ?? "")}</span>}
                      </div>
                    </td>
                  );
                }
                if (c.kind === "ext") {
                  return (
                    <td key={c.key} className={`${base} ${c.sticky ? "sticky left-0 bg-slate-900 z-10" : ""}`}>
                      {row.epUrl
                        ? <a href={row.epUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-blue-400 inline-flex items-center gap-1">{cleanName(row.name ?? "")}<span className="text-[9px] text-slate-500" aria-hidden>↗</span></a>
                        : <span className="font-medium">{cleanName(row.name ?? "")}</span>}
                    </td>
                  );
                }
                if (c.kind === "team") {
                  return (
                    <td key={c.key} className={base}>
                      {row.teamSlug ? (
                        <Link href={`/teams/${row.teamSlug}`} className="inline-flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                          {row.teamLogo && <img src={row.teamLogo} alt="" className="w-5 h-5 object-contain" />}
                          <span className="font-medium">{row.teamCode ?? "—"}</span>
                        </Link>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                  );
                }
                if (c.kind === "interest") {
                  return (
                    <td key={c.key} className={base}>
                      {interestCtx ? <InterestButton playerId={row._id} name={row.name ?? ""} ctx={interestCtx} /> : null}
                    </td>
                  );
                }
                const v = row[c.key];
                const preColor = row[`_c_${c.key}`] as string | undefined; // optional server-computed colour
                if (c.kind === "money") return <td key={c.key} className={`${base} tabular-nums text-slate-200 whitespace-nowrap`}>{money(Number(v ?? 0))}</td>;
                if (c.kind === "ovr") { const n = Number(v ?? 0); return <td key={c.key} className={`${base} tabular-nums font-bold ${preColor ?? (n ? ovrColor(n) : "text-slate-400")}`}>{v ?? "—"}</td>; }
                if (c.kind === "years") return <td key={c.key} className={`${base} tabular-nums text-slate-300`}>{v ?? "—"}</td>;
                if (c.kind === "num") return <td key={c.key} className={`${base} tabular-nums ${preColor ?? "text-slate-400"}`}>{v ?? "—"}</td>;
                return <td key={c.key} className={`${base} text-slate-400 whitespace-nowrap`}>{v ?? "—"}</td>;
              })}
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={cols.length} className="px-4 py-8 text-center text-slate-500">No players match “{q}”.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
