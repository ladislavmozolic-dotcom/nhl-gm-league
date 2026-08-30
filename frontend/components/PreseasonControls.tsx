"use client";

import { useState, useTransition } from "react";
import { generatePreseasonAction, simPreseasonAction, setPreseasonPublicAction } from "@/app/admin/season/actions";
import { friendlyActionError } from "@/lib/client/action-error";

export default function PreseasonControls({ scheduled, played, isPublic }: { scheduled: number; played: number; isPublic: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [pub, setPub] = useState(isPublic);

  const gen = () => start(async () => {
    setMsg(null);
    try {
      const r = await generatePreseasonAction(startDate || undefined);
      setMsg(`Generated ${r.games} games · ${r.teams} teams · 6 rounds — runs ${r.firstDate} → ${r.lastDate} (rest day between). Advance days to play it out, or use Simulate all.`);
    } catch (e) { setMsg(friendlyActionError(e)); }
  });
  const sim = () => start(async () => {
    setMsg(null);
    try {
      const r = await simPreseasonAction();
      setMsg(`Simulated ${r.played} pre-season games.`);
    } catch (e) { setMsg(friendlyActionError(e)); }
  });
  const togglePublic = () => start(async () => {
    setMsg(null);
    try {
      const r = await setPreseasonPublicAction(!pub);
      setPub(r.preseasonPublic);
    } catch (e) { setMsg(friendlyActionError(e)); }
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400 max-w-xl">
        Build a <span className="text-slate-200">6-game exhibition schedule</span> per club (a rest day between rounds), just before the
        regular season. Pre-season is <span className="text-slate-200">purely exhibition</span> — it has its own scoreboard/standings/stats
        but never touches profiles, careers, standings or the regular season, and doesn&apos;t injure players or drain condition.
        Once generated, <span className="text-slate-200">advancing the league day</span> plays each slate on its date automatically.
      </p>
      <p className="text-xs text-slate-500">
        Currently: {scheduled} scheduled · {played} played ·{" "}
        {pub
          ? <span className="text-emerald-400">public — visible to everyone on /preseason</span>
          : <span className="text-amber-400">admin-only — hidden from /preseason until you make it public</span>}
      </p>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="text-xs text-slate-400">Start day
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" />
        </label>
        <button onClick={gen} disabled={pending}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-semibold text-sm">Generate pre-season</button>
        <button onClick={sim} disabled={pending || scheduled === 0}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-semibold text-sm">Simulate all now</button>
        <button onClick={togglePublic} disabled={pending}
          className={`px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-40 ${pub ? "bg-slate-700 hover:bg-slate-600" : "bg-amber-600 hover:bg-amber-500"}`}>
          {pub ? "Hide from public" : "Make public"}
        </button>
        {pending && <span className="text-xs text-slate-500">working…</span>}
      </div>
      <p className="text-[11px] text-slate-500">Leave the start day blank to default to late September (ending Sep 30, before an Oct 1 regular-season start). Clicking &quot;Off-season&quot; above in League Phase also auto-(re)generates this, timed 3 days before the real regular-season opener — but never touches visibility.</p>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      <a href="/preseason" className="inline-block text-xs text-sky-400 hover:underline">View pre-season schedule &amp; results →</a>
    </div>
  );
}
