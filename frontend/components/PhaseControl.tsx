"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPhaseOverrideAction } from "@/app/admin/season/actions";
import { friendlyActionError } from "@/lib/client/action-error";

const OPTIONS = [
  { key: "offseason", label: "Off-season" },
  { key: "preseason", label: "Pre-season" },
  { key: "regular", label: "Regular season" },
  { key: "playoffs", label: "Playoffs" },
];

export default function PhaseControl({ current, override, label }: { current: string; override: string | null; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const set = (p: string | null) => start(async () => {
    setErr(null);
    try { await setPhaseOverrideAction(p); router.refresh(); }
    catch (e) { setErr(friendlyActionError(e)); }
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((o) => (
          <button key={o.key} onClick={() => set(o.key)} disabled={pending}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${override === o.key ? "border-blue-500 bg-blue-600 text-white" : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"}`}>
            {o.label}
          </button>
        ))}
        <button onClick={() => set(null)} disabled={pending}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${override === null ? "border-emerald-500 bg-emerald-600/20 text-emerald-300" : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"}`}>
          Auto (calendar)
        </button>
      </div>
      <div className="text-xs text-slate-500">
        Current phase: <span className="text-slate-300 font-medium">{label}</span>
        {override
          ? " · pinned by admin — automatic daily sim is paused while a phase is pinned"
          : " · following the calendar — scheduled games auto-simulate every day at 20:30 Europe/Bratislava"}
      </div>
      {err && <div className="text-xs text-red-400">{err}</div>}
    </div>
  );
}
