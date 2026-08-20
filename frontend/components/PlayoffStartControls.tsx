"use client";

import { useState, useTransition } from "react";
import { startPlayoffsScheduledAction } from "@/app/admin/season/actions";

export default function PlayoffStartControls() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");

  const go = () => start(async () => {
    setMsg(null);
    const r = await startPlayoffsScheduledAction(startDate || undefined);
    setMsg(`Seeded ${r.series} first-round series — Game 1 on ${r.firstDate}. Advance the league day to play it out (2-day cadence, no back-to-backs); rounds advance automatically.`);
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400 max-w-xl">
        Seed the bracket from the final standings and <span className="text-slate-200">schedule round 1</span> starting on a day you choose.
        Games run <span className="text-slate-200">every other day</span> so no team ever plays two days in a row; each next round is
        seeded &amp; scheduled automatically as series finish. Then just <span className="text-slate-200">advance the league day</span>.
      </p>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="text-xs text-slate-400">Round 1 start day
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" />
        </label>
        <button onClick={go} disabled={pending}
          className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 font-semibold text-sm">Start playoffs (scheduled)</button>
        {pending && <span className="text-xs text-slate-500">working…</span>}
      </div>
      <p className="text-[11px] text-slate-500">Blank start day = the default post-season slot. This re-seeds the bracket from the current standings.</p>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
    </div>
  );
}
