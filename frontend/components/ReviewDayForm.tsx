"use client";

import { useState, useTransition } from "react";
import { reviewDayAction } from "@/app/admin/discipline/actions";

/** Re-run the Player Safety review for one day (repeat-safe). */
export default function ReviewDayForm({ defaultDate }: { defaultDate: string }) {
  const [date, setDate] = useState(defaultDate);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = () => start(async () => {
    setMsg(null);
    const r = await reviewDayAction(date);
    setMsg(r.ok
      ? { ok: true, text: `Reviewed ${r.games} game(s): ${r.suspensions} new suspension(s), ${r.fines} fine(s).` }
      : { ok: false, text: r.error ?? "Failed" });
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className="bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200" />
      <button onClick={run} disabled={pending || !date}
        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50">
        {pending ? "Reviewing…" : "Review games of this day"}
      </button>
      {msg && <span className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
    </div>
  );
}
