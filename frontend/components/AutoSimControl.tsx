"use client";

import { useState, useTransition } from "react";
import { setAutoSim, runSimNow } from "@/app/admin/lines/actions";

export default function AutoSimControl({ enabled, hour, minute, lastRunDate }: {
  enabled: boolean; hour: number; minute: number; lastRunDate: string | null;
}) {
  const [on, setOn] = useState(enabled);
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const save = (nextOn: boolean) => start(async () => { setMsg(null); await setAutoSim(nextOn, h, m); setOn(nextOn); setMsg("Saved."); });
  const now = () => start(async () => { setMsg(null); const r = await runSimNow(); setMsg(r.played ? `Played round ${r.round} — ${r.played} games.` : "No scheduled games to play."); });

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${on ? "bg-green-500" : "bg-slate-600"}`} />
            <h2 className="font-bold">Automatic Simulation</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">Plays the next day of games daily at the set Bratislava time. Last run: <b>{lastRunDate ?? "never"}</b>.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1">at
            <input type="number" min={0} max={23} value={h} onChange={(e) => setH(Number(e.target.value))} className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center" />
            :
            <input type="number" min={0} max={59} value={m} onChange={(e) => setM(Number(e.target.value))} className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center" />
          </label>
          <button onClick={() => save(on)} disabled={pending} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold disabled:opacity-50">Save time</button>
          <button onClick={() => save(!on)} disabled={pending}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 ${on ? "bg-red-600/80 hover:bg-red-500 text-white" : "bg-green-600 hover:bg-green-500 text-white"}`}>
            {on ? "Disable" : "Enable"}
          </button>
          <button onClick={now} disabled={pending} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50">Run day now</button>
        </div>
      </div>
      {msg && <p className="text-green-400 text-xs mt-2">{msg}</p>}
    </div>
  );
}
