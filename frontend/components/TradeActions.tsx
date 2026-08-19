"use client";

import { useState, useTransition } from "react";
import { respondToTrade, cancelTrade, deleteTradeAction, analyzeTradeByIdAction } from "@/app/trades/build/actions";

export default function TradeActions({ tradeId, role, admin }: { tradeId: number; role?: "receiver" | "proposer" | null; admin?: boolean }) {
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
      {admin && (
        <button
          onClick={() => { if (confirm("Delete this trade record? This removes it entirely (does not reverse an already-applied deal).")) run(() => deleteTradeAction(tradeId)); }}
          disabled={pending}
          className="px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-800/50 hover:bg-red-900/60 text-red-300 text-sm font-semibold disabled:opacity-40" title="Commissioner: delete this trade">
          {pending ? "…" : "🗑 Delete"}
        </button>
      )}
      {(role === "receiver" || role === "proposer" || admin) && (
        <button onClick={analyze} disabled={aiPending}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold disabled:opacity-40"
          title="AI GM Assistance — over hodnotu a zmysel výmeny pred rozhodnutím">
          {aiPending ? "Analyzujem…" : "🤖 AI Helper"}
        </button>
      )}
      {err && <span className="text-red-400 text-xs">{err}</span>}

      {ai && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAi(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">🤖 AI GM Assistance — analýza výmeny</h3>
              <button onClick={() => setAi(null)} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
            </div>
            {!ai.ok ? <p className="text-rose-400 text-sm">{ai.error}</p> : (
              <>
                <div className={`rounded-xl px-4 py-3 mb-4 border ${ai.tilt === "even" ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300" : "bg-amber-950/30 border-amber-800/50 text-amber-300"}`}>
                  <div className="text-sm font-bold">{ai.verdict}</div>
                  <div className="text-xs mt-1 text-slate-400">{ai.fromName}: {ai.meGives} hodnoty daných · {ai.meGets} získaných</div>
                </div>
                <ul className="space-y-1.5 mb-3">
                  {ai.reasoning.map((r, i) => <li key={i} className="text-sm text-slate-200 flex gap-2"><span className="text-violet-400">•</span><span dangerouslySetInnerHTML={{ __html: r }} /></li>)}
                </ul>
                <p className="text-[11px] text-slate-500 mb-3">Heuristická analýza (overall, vek, cap, pick hodnota) — orientačná.</p>
                <button onClick={() => setAi(null)} className="px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold text-sm">Zavrieť</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
