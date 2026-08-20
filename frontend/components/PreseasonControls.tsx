"use client";

import { useState, useTransition } from "react";
import { generatePreseasonAction, simPreseasonAction } from "@/app/admin/season/actions";

export default function PreseasonControls({ scheduled, played }: { scheduled: number; played: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");

  const gen = () => start(async () => {
    setMsg(null);
    const r = await generatePreseasonAction(startDate || undefined);
    setMsg(`Generated ${r.games} games · ${r.teams} teams · 6 rounds — runs ${r.firstDate} → ${r.lastDate} (rest day between). Advance days to play it out, or use Simulate all.`);
  });
  const sim = () => start(async () => {
    setMsg(null);
    const r = await simPreseasonAction();
    setMsg(`Simulated ${r.played} pre-season games.`);
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400 max-w-xl">
        Build a <span className="text-slate-200">6-game exhibition schedule</span> per club (a rest day between rounds), just before the
        regular season. Pre-season is <span className="text-slate-200">purely exhibition</span> — it has its own scoreboard/standings/stats
        but never touches profiles, careers, standings or the regular season, and doesn&apos;t injure players or drain condition.
        Once generated, <span className="text-slate-200">advancing the league day</span> plays each slate on its date automatically.
      </p>
      <p className="text-xs text-slate-500">Currently: {scheduled} scheduled · {played} played.</p>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="text-xs text-slate-400">Start day
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" />
        </label>
        <button onClick={gen} disabled={pending}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-semibold text-sm">Generate pre-season</button>
        <button onClick={sim} disabled={pending || scheduled === 0}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-semibold text-sm">Simulate all now</button>
        {pending && <span className="text-xs text-slate-500">working…</span>}
      </div>
      <p className="text-[11px] text-slate-500">Leave the start day blank to default to late September (ending Sep 30, before an Oct 1 regular-season start).</p>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      <a href="/preseason" className="inline-block text-xs text-sky-400 hover:underline">View pre-season schedule &amp; results →</a>
    </div>
  );
}
