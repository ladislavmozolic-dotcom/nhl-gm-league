"use client";

import { useState, useTransition } from "react";
import { simNextDayAction, simNextDaysAction, restDayAction } from "@/app/admin/season/actions";

const DAY_OPTIONS = [1, 3, 5, 7, 10, 14, 21, 30];

export default function DaySimControls() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "err" | "info">("info");
  const [days, setDays] = useState(1);

  const fmt = (d: Date | string | null, round: number | null) =>
    d ? new Date(d).toLocaleDateString("sk-SK", { day: "numeric", month: "long" }) : `day ${round}`;

  const simDay = () => start(async () => {
    setMsg(null);
    try {
      if (days <= 1) {
        const r = await simNextDayAction();
        if (r.done) { setTone("info"); setMsg("Season complete — no scheduled games left to play."); return; }
        setTone("ok"); setMsg(`Simulated ${fmt(r.date, r.round)} — ${r.played} game${r.played === 1 ? "" : "s"} played.`);
      } else {
        const r = await simNextDaysAction(days);
        const tail = r.done ? " (season ran out of games)" : "";
        setTone("ok");
        setMsg(`Simulated ${r.days} day${r.days === 1 ? "" : "s"} through ${fmt(r.date, r.round)} — ${r.played} game${r.played === 1 ? "" : "s"} played${tail}.`);
      }
    } catch (e) { setTone("err"); setMsg((e as Error).message); }
  });

  const restDay = () => start(async () => {
    setMsg(null);
    try {
      const r = await restDayAction();
      setTone("ok"); setMsg(`Rest day applied — skaters +${r.skRec} CON, goalies +2, injuries healed a day.`);
    } catch (e) { setTone("err"); setMsg((e as Error).message); }
  });

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 mb-5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-400/90">Admin — Manual Sim</span>
        <div className="inline-flex items-center gap-1.5">
          <label className="text-xs text-slate-400">Days</label>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={pending}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm">
            {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button onClick={simDay} disabled={pending}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold">
          {pending ? "Working…" : days <= 1 ? "▶ Sim Next Day" : `▶ Sim ${days} Days`}
        </button>
        <button onClick={restDay} disabled={pending}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold" title="Recover CON + heal injuries a day, no games">
          😴 Rest Day
        </button>
        <span className="text-xs text-slate-500">Fallback if the nightly auto-sim fails, or step through practice sims day by day.</span>
      </div>
      {msg && (
        <div className={`mt-2 text-sm ${tone === "ok" ? "text-green-300" : tone === "err" ? "text-red-300" : "text-slate-300"}`}>{msg}</div>
      )}
    </div>
  );
}
