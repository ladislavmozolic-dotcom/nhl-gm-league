"use client";

import { useState, useTransition } from "react";
import { toggleDraftTestModeAction, resetDraftBoardAction } from "@/app/draft/room/actions";

/** Admin-only: draft test mode (picks don't write to teams) + reset the board. */
export default function DraftTestControls({ testMode }: { testMode: boolean }) {
  const [on, setOn] = useState(testMode);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const toggle = () => start(async () => { const r = await toggleDraftTestModeAction(); if (r.ok) { setOn(r.testMode); setMsg(r.testMode ? "Test režim ZAP — výber sa nezapíše na tím." : "Test režim VYP — výber zapíše hráča na tím."); } });
  const reset = () => start(async () => { setConfirm(false); const r = await resetDraftBoardAction(); setMsg(r.ok ? `Draft board resetnutý — ${r.unDrafted} hráčov späť v ponuke.` : r.error); });

  return (
    <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 mb-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-400/90">Draft — Test</span>
        <button onClick={toggle} disabled={pending}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 ${on ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-200"}`}>
          {on ? "🧪 Test režim: ZAP" : "Test režim: VYP"}
        </button>
        {confirm ? (
          <span className="flex items-center gap-2">
            <button onClick={reset} disabled={pending} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50">Potvrdiť reset</button>
            <button onClick={() => setConfirm(false)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-sm">Zrušiť</button>
          </span>
        ) : (
          <button onClick={() => setConfirm(true)} disabled={pending} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold disabled:opacity-50">↺ Reset draft board</button>
        )}
        <span className="text-xs text-slate-500">V test režime výber posunie board, ale hráča nezapíše na tím — po resete sú mená späť.</span>
      </div>
      {msg && <p className="text-sm text-amber-300 mt-2">{msg}</p>}
    </div>
  );
}
