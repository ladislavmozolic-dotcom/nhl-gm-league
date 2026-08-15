"use client";

import { useState, useTransition } from "react";
import { respondToTrade, cancelTrade, deleteTradeAction } from "@/app/trades/build/actions";

export default function TradeActions({ tradeId, role, admin }: { tradeId: number; role?: "receiver" | "proposer" | null; admin?: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) => start(async () => {
    setErr(null);
    try { await fn(); } catch (e) { setErr((e as Error).message); }
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {role === "receiver" ? (
        <>
          <button onClick={() => run(() => respondToTrade(tradeId, true))} disabled={pending}
            className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold disabled:opacity-40">
            {pending ? "…" : "Accept"}
          </button>
          <button onClick={() => run(() => respondToTrade(tradeId, false))} disabled={pending}
            className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold disabled:opacity-40">
            Decline
          </button>
        </>
      ) : role === "proposer" ? (
        <button onClick={() => run(() => cancelTrade(tradeId))} disabled={pending}
          className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold disabled:opacity-40">
          {pending ? "…" : "Cancel proposal"}
        </button>
      ) : null}
      {admin && (
        <button
          onClick={() => { if (confirm("Delete this trade record? This removes it entirely (does not reverse an already-applied deal).")) run(() => deleteTradeAction(tradeId)); }}
          disabled={pending}
          className="px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-800/50 hover:bg-red-900/60 text-red-300 text-sm font-semibold disabled:opacity-40" title="Commissioner: delete this trade">
          {pending ? "…" : "🗑 Delete"}
        </button>
      )}
      {err && <span className="text-red-400 text-xs">{err}</span>}
    </div>
  );
}
