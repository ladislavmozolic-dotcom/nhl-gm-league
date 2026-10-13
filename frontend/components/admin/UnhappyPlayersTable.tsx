"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UnhappyData, UnhappyRow } from "@/lib/unhappy-players-server";

type Filter = "all" | "warned" | "trade" | "ok";

export default function UnhappyPlayersTable({ data: initial }: { data: UnhappyData }) {
  const router = useRouter();
  const [now, setNow] = useState<Record<number, NonNullable<UnhappyRow["now"]>> | null>(null);
  const [nowErr, setNowErr] = useState<string | null>(null);
  // the live ice-time re-check takes ~15 s (whole league) — fetched after the page is on screen
  useEffect(() => {
    let alive = true;
    setNow(null); setNowErr(null);
    fetch("/api/admin/unhappy/evaluate").then((r) => r.json()).then((j) => { if (!alive) return; if (j.ok) setNow(j.now); else setNowErr(j.error ?? "Re-check failed."); }).catch(() => alive && setNowErr("Re-check failed."));
    return () => { alive = false; };
  }, [initial]);
  const data = useMemo(() => ({ ...initial, rows: initial.rows.map((r) => ({ ...r, now: now?.[r.id] ?? null })) }), [initial, now]);
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(() => data.rows.filter((r) => {
    if (search && !`${r.name} ${r.teamCode ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "warned") return !!r.warnedAt || r.promiseWarned;
    if (filter === "trade") return r.tradeRequested;
    if (filter === "ok") return !!r.now && !r.now.unhappy; // flagged, but fine by today's check
    return true;
  }), [data.rows, filter, search]);

  const clear = (ids: number[], label: string) => {
    if (!confirm(`Clear the unhappiness of ${label}?`)) return;
    setErr(null);
    start(async () => {
      const res = await fetch("/api/admin/unhappy/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerIds: ids }) });
      const json = await res.json().catch(() => ({ ok: false, error: "Request failed." }));
      if (json.ok) router.refresh(); else setErr(json.error ?? "Failed.");
    });
  };

  const count = (f: Filter) => data.rows.filter((r) => f === "warned" ? (!!r.warnedAt || r.promiseWarned) : f === "trade" ? r.tradeRequested : f === "ok" ? !!r.now && !r.now.unhappy : true).length;
  const tab = (f: Filter, label: string) => (
    <button key={f} type="button" onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${filter === f ? "bg-blue-600 text-white border-blue-500" : "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"}`}>
      {label} <span className="opacity-70">{count(f)}</span>
    </button>
  );
  const okIds = data.rows.filter((r) => !!r.now && !r.now.unhappy).map((r) => r.id);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-800">
        {tab("all", "All")}{tab("warned", "Warned")}{tab("trade", "Trade request")}{tab("ok", "Fine today")}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Player or team…" className="ml-auto bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 w-44" />
        {okIds.length > 0 && (
          <button type="button" disabled={pending} onClick={() => clear(okIds, `${okIds.length} players who are fine by today's check`)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-500 text-white disabled:opacity-50">
            Clear all “fine today” ({okIds.length})
          </button>
        )}
      </div>
      {err && <p className="px-4 py-2 text-xs text-red-300">{err}</p>}
      {!now && !nowErr && <p className="px-4 py-2 text-xs text-slate-500">Re-checking everyone&apos;s ice time live… (about 15 seconds)</p>}
      {nowErr && <p className="px-4 py-2 text-xs text-amber-300">{nowErr}</p>}
      {rows.length === 0 ? (
        <p className="text-center text-slate-500 py-10 text-sm">Nobody matches.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                <th className="text-left px-4 py-3 font-medium">Player</th>
                <th className="text-left px-3 py-3 font-medium">Status</th>
                <th className="text-left px-3 py-3 font-medium">Ice time right now</th>
                <th className="text-left px-3 py-3 font-medium">Promise</th>
                <th className="text-right px-3 py-3 font-medium">Morale</th>
                <th className="text-right px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <Row key={r.id} r={r} data={data} pending={pending} pendingNow={!now && !nowErr} onClear={() => clear([r.id], r.name)} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ r, data, pending, pendingNow, onClear }: { r: UnhappyRow; data: UnhappyData; pending: boolean; pendingNow: boolean; onClear: () => void }) {
  const badge = (txt: string, cls: string, title?: string) => <span title={title} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${cls}`}>{txt}</span>;
  return (
    <tr className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30 align-top">
      <td className="px-4 py-3">
        <Link href={`/players/${r.slug ?? r.id}`} className="font-medium hover:text-sky-400">{r.name}</Link>
        <div className="text-[11px] text-slate-500">{r.position} · {r.teamCode ?? "—"}</div>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          {r.tradeRequested && badge(`🚨 Trade request${r.tradeReason ? ` (${r.tradeReason === "ice" ? "ice time" : r.tradeReason})` : ""}`, "bg-red-950/80 border-red-800/60 text-red-300")}
          {r.warnedAt && badge("🗣️ Warned", "bg-orange-950/80 border-orange-800/60 text-orange-300", `Agent warned the GM on ${new Date(r.warnedAt).toLocaleDateString("en-GB")}`)}
          {r.promiseWarned && badge("⚠️ Broken promise", "bg-amber-950/80 border-amber-800/60 text-amber-300")}
          {r.disgruntled && badge("Disgruntled", "bg-amber-950/80 border-amber-800/60 text-amber-300")}
          {r.checks > 0 && badge(`${r.checks} day${r.checks === 1 ? "" : "s"}`, "bg-slate-800 border-slate-700 text-slate-300", `Unhappy days counted: warns at ${data.warnDays}, trade request at ${data.requestDays}`)}
        </div>
      </td>
      <td className="px-3 py-3 text-xs">
        {r.now ? (
          <>
            <div className="tabular-nums text-slate-200">{r.now.actual} <span className="text-slate-500">vs {r.now.expected} ({r.now.role})</span></div>
            <div className="text-[11px] text-slate-500">{r.now.games} games · {Math.round(r.now.ratio * 100)}% of expected</div>
            <div className={`text-[11px] font-semibold ${r.now.unhappy ? "text-rose-400" : "text-emerald-400"}`}>{r.now.unhappy ? `still unhappy (below ${data.pct}%)` : "fine by today's check"}</div>
          </>
        ) : <span className="text-slate-600">{pendingNow ? "checking…" : "not evaluated (injured / too few games / spare role)"}</span>}
      </td>
      <td className="px-3 py-3 text-xs text-slate-400">{r.promise ?? <span className="text-slate-600">—</span>}</td>
      <td className="px-3 py-3 text-right tabular-nums text-slate-300">{r.morale}</td>
      <td className="px-4 py-3 text-right">
        <button type="button" disabled={pending} onClick={onClear} className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50">Clear</button>
      </td>
    </tr>
  );
}
