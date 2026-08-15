"use client";

import { useState, useTransition } from "react";
import { openVotingAction, closeVotingAction, resolveVotingAction, regenerateAiAction } from "@/app/admin/awards/actions";

type Status = "NONE" | "OPEN" | "CLOSED" | "RESOLVED";

export default function AwardVotingAdmin({ season, league, status }: { season: string; league: string; status: Status }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<any>, label: string) => start(async () => {
    setMsg(null);
    try { const r = await fn(); setMsg(`${label}: ${JSON.stringify(r)}`); }
    catch (e: any) { setMsg(`${label} failed: ${e?.message ?? e}`); }
  });

  const badge = {
    NONE: "bg-slate-700 text-slate-300", OPEN: "bg-emerald-600 text-white",
    CLOSED: "bg-amber-600 text-white", RESOLVED: "bg-blue-600 text-white",
  }[status];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-slate-100">Voting</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>{status}</span>
        <span className="text-xs text-slate-500">{season} · {league}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => run(() => openVotingAction(season, league), "Open")} disabled={pending || status === "OPEN"} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium px-3 py-2">Open voting + seed AI</button>
        <button onClick={() => run(() => regenerateAiAction(season, league), "Regen AI")} disabled={pending || status !== "OPEN"} className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-sm font-medium px-3 py-2">Re-seed AI ballots</button>
        <button onClick={() => run(() => closeVotingAction(season, league), "Close")} disabled={pending || status !== "OPEN"} className="rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-medium px-3 py-2">Close voting</button>
        <button onClick={() => run(() => resolveVotingAction(season, league), "Resolve")} disabled={pending || status === "NONE" || status === "RESOLVED"} className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-3 py-2">Resolve + archive</button>
      </div>
      {msg && <p className="text-xs text-slate-400 break-all">{msg}</p>}
    </div>
  );
}
