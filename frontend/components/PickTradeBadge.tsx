"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { TradeHistoryEntry } from "@/lib/trade-history-server";

const AssetChips = ({ items }: { items: { text: string; logoUrl?: string | null }[] }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.length === 0 && <span className="text-slate-600 text-xs">nothing</span>}
    {items.map((it, i) => (
      <span key={i} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-100 inline-flex items-center gap-1.5">
        {it.logoUrl && <img src={it.logoUrl} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
        {it.text}
      </span>
    ))}
  </div>
);

/** A traded draft pick's logo/code badge — clickable (only when it actually
 *  changed hands in a trade) to pop up which trade(s) brought it here. Used
 *  on both a team's own Draft Picks page and the All Rosters tool. */
export default function PickTradeBadge({
  pickId, teamName, code, logoUrl, size = 32, clickable,
  fetchHistory,
}: {
  pickId: number; teamName: string; code: string; logoUrl: string | null; size?: number; clickable: boolean;
  fetchHistory: (pickId: number) => Promise<TradeHistoryEntry[]>;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<TradeHistoryEntry[] | null>(null);
  const [pending, startTransition] = useTransition();

  const badge = logoUrl
    ? <img src={logoUrl} alt={code} className="object-contain" style={{ width: size, height: size }} />
    : <div className="rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-500" style={{ width: size, height: size, fontSize: size * 0.3 }}>{code || "?"}</div>;

  if (!clickable) return <div title={teamName}>{badge}</div>;

  const onOpen = () => {
    setOpen(true);
    if (history === null) startTransition(async () => setHistory(await fetchHistory(pickId)));
  };

  return (
    <>
      <button type="button" onClick={onOpen} title={`${teamName} — click for trade details`} className="rounded-full hover:ring-2 hover:ring-blue-500/60 transition-shadow">
        {badge}
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-[#0f1d32] border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Pick trade history</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
            </div>
            {pending && history === null ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : !history || history.length === 0 ? (
              <p className="text-sm text-slate-500">No trade found for this pick.</p>
            ) : (
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.tradeId} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
                        {h.fromTeam?.logoUrl && <img src={h.fromTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                        {h.fromTeam?.name ?? "Team"}
                        <span className="text-slate-600">→</span>
                        {h.toTeam?.logoUrl && <img src={h.toTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                        {h.toTeam?.name ?? "Team"}
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{h.date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-600 mb-1">{h.toTeam?.name ?? "Team"} received</p>
                        <AssetChips items={h.fromLabels} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-600 mb-1">{h.fromTeam?.name ?? "Team"} received</p>
                        <AssetChips items={h.toLabels} />
                      </div>
                    </div>
                    <Link href={`/trades/${h.tradeId}`} className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block">View full trade #{h.tradeId} →</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
