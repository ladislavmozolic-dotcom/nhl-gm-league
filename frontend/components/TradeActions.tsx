"use client";

import { useState, useTransition } from "react";
import { respondToTrade, cancelTrade, deleteTradeAction, analyzeTradeByIdAction } from "@/app/trades/build/actions";
import GMAssistModal from "@/components/GMAssistModal";

export default function TradeActions({ tradeId, role, admin, pending: isPending }: { tradeId: number; role?: "receiver" | "proposer" | null; admin?: boolean; pending?: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [aiPending, aiStart] = useTransition();
  const [ai, setAi] = useState<Awaited<ReturnType<typeof analyzeTradeByIdAction>> | null>(null);
  const analyze = () => aiStart(async () => { setAi(await analyzeTradeByIdAction(tradeId)); });

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
      {/* Commissioner override — approve/decline on the receiving GM's behalf (a GM who
          couldn't confirm his own trade). Only for a still-pending trade, and only when
          the comish isn't already the receiver (who has the normal buttons above). */}
      {admin && isPending && role !== "receiver" && (
        <>
          <button onClick={() => run(() => respondToTrade(tradeId, true))} disabled={pending}
            className="px-4 py-1.5 rounded-lg bg-fuchsia-700 hover:bg-fuchsia-600 text-white text-sm font-semibold disabled:opacity-40" title="Commissioner: approve this trade on the receiving GM's behalf">
            {pending ? "…" : "★ Approve (Comish)"}
          </button>
          <button onClick={() => run(() => respondToTrade(tradeId, false))} disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold disabled:opacity-40" title="Commissioner: decline this trade">
            Decline (Comish)
          </button>
        </>
      )}
      {admin && (
        <button
          onClick={() => { if (confirm("Delete this trade record? A completed deal is fully undone first — players, picks and cash go back to their original teams — then the record is removed.")) run(() => deleteTradeAction(tradeId)); }}
          disabled={pending}
          className="px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-800/50 hover:bg-red-900/60 text-red-300 text-sm font-semibold disabled:opacity-40" title="Commissioner: delete this trade">
          {pending ? "…" : "🗑 Delete"}
        </button>
      )}
      {(role === "receiver" || role === "proposer" || admin) && (
        <button onClick={analyze} disabled={aiPending}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold disabled:opacity-40"
          title="GM Assist — check the value and sense of the trade before deciding">
          {aiPending ? "Analyzujem…" : "🤖 GM Assist"}
        </button>
      )}
      {err && <span className="text-red-400 text-xs">{err}</span>}

      <GMAssistModal data={ai} onClose={() => setAi(null)} />
    </div>
  );
}
