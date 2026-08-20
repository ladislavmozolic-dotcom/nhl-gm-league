"use client";

import { useState, useTransition } from "react";
import { generatePreseasonAction, simPreseasonAction } from "@/app/admin/season/actions";

export default function PreseasonControls({ scheduled, played }: { scheduled: number; played: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const gen = () => start(async () => {
    setMsg(null);
    const r = await generatePreseasonAction();
    setMsg(`Generated ${r.games} pre-season games (${r.teams} teams · ${r.rounds} rounds).`);
  });
  const sim = () => start(async () => {
    setMsg(null);
    const r = await simPreseasonAction();
    setMsg(`Simulated ${r.played} pre-season games.`);
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400 max-w-xl">
        Build a <span className="text-slate-200">6-game exhibition schedule</span> per club (a rest day between rounds), played out just
        before the regular season. Pre-season games are <span className="text-slate-200">purely exhibition</span> — they never touch
        standings, stats, careers or records, and don&apos;t injure players or drain condition.
      </p>
      <p className="text-xs text-slate-500">Currently: {scheduled} scheduled · {played} played.</p>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={gen} disabled={pending}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-semibold text-sm">Generate pre-season</button>
        <button onClick={sim} disabled={pending || scheduled === 0}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-semibold text-sm">Simulate all pre-season</button>
        {pending && <span className="text-xs text-slate-500">working…</span>}
      </div>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      <a href="/preseason" className="inline-block text-xs text-sky-400 hover:underline">View pre-season schedule &amp; results →</a>
    </div>
  );
}
