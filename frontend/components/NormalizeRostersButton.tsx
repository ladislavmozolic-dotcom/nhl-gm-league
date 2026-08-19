"use client";

import { useState, useTransition } from "react";
import { normalizeAllRostersAction } from "@/app/admin/rosters/actions";

/** League-wide roster reset: auto-lines every team and pushes all non-lineup
 *  (healthy) players to the farm. Confirm-gated — it reassigns every club. */
export default function NormalizeRostersButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  const run = () => start(async () => {
    setMsg(null); setConfirm(false);
    const r = await normalizeAllRostersAction();
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: `Done — auto-lined ${r.teams} teams, ${r.sentDown} players to the farms (${r.scratched} scratched). One-way players kept on the NHL roster.` });
  });

  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="font-bold text-sm mb-1">Reset all rosters to Auto Lines</h3>
      <p className="text-xs text-slate-400 mb-3">For every club: build position-aware auto lines from the whole org, keep those dressed players on the NHL roster, and send every other <b>healthy</b> player down to the affiliate. Injured players stay on the NHL roster. Overwrites current lines &amp; roster assignments league-wide.</p>
      {confirm ? (
        <div className="flex items-center gap-2">
          <button onClick={run} disabled={pending} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50">{pending ? "Working…" : "Confirm — reset all 32 teams"}</button>
          <button onClick={() => setConfirm(false)} disabled={pending} className="px-3 py-1.5 rounded-lg bg-slate-700 text-sm">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} disabled={pending} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50">Send AHL players down + auto-line every team</button>
      )}
      {msg && <p className={`text-sm mt-3 ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</p>}
    </div>
  );
}
