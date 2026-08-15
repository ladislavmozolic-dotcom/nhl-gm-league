"use client";

import { useState, useTransition } from "react";
import { simNextDayAction, restDayAction } from "@/app/admin/season/actions";

export default function DaySimControls() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "err" | "info">("info");

  const simDay = () => start(async () => {
    setMsg(null);
    try {
      const r = await simNextDayAction();
      if (r.done) { setTone("info"); setMsg("Season complete — no scheduled games left to play."); return; }
      const d = r.date ? new Date(r.date).toLocaleDateString("sk-SK", { day: "numeric", month: "long" }) : `day ${r.round}`;
      setTone("ok"); setMsg(`Simulated ${d} — ${r.played} game${r.played === 1 ? "" : "s"} played.`);
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
        <button onClick={simDay} disabled={pending}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold">
          {pending ? "Working…" : "▶ Sim Next Day"}
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
