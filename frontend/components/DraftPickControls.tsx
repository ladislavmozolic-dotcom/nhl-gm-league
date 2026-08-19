"use client";

import { useState, useTransition } from "react";
import { resetOwnDraftPicksAction, rollDraftYearForwardAction } from "@/app/admin/season/actions";

/** Admin: own-picks reset + yearly roll-forward for the draft-pick horizon. */
export default function DraftPickControls() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const reset = () => start(async () => {
    setMsg(null);
    const r = await resetOwnDraftPicksAction(5);
    setMsg(r.ok ? { ok: true, text: `Every club owns its own picks for ${r.years.join(", ")} (${r.created} picks).` } : { ok: false, text: r.error });
  });
  const roll = () => start(async () => {
    setMsg(null);
    const r = await rollDraftYearForwardAction();
    setMsg(r.ok ? { ok: true, text: `Rolled forward — dropped ${r.dropped}, added ${r.added}.` } : { ok: false, text: r.error });
  });

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 mb-5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-400/90">Draft Picks</span>
        <button onClick={reset} disabled={pending} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold">
          {pending ? "Working…" : "Give every team its own 5 years of picks"}
        </button>
        <button onClick={roll} disabled={pending} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold" title="After a season: drop the drafted year, add a new 5th year">
          {pending ? "Working…" : "Roll draft year forward (+1)"}
        </button>
        <span className="text-xs text-slate-500">Own picks only (no real-NHL trades). Run the roll-forward once per season.</span>
      </div>
      {msg && <div className={`mt-2 text-sm ${msg.ok ? "text-green-300" : "text-red-300"}`}>{msg.text}</div>}
    </div>
  );
}
