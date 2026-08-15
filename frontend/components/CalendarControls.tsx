"use client";

import { useState, useTransition } from "react";
import { advanceLeagueDayAction, setLeagueDateAction, startLeagueClockAction } from "@/app/admin/season/actions";

type Props = {
  isAdmin: boolean;
  dateISO: string;
  dateLabel: string;
  phaseLabel: string;
  phase: string;
  frenzyDay: number;
};

const PHASE_TONE: Record<string, string> = {
  frenzy: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  offseason: "bg-slate-600/20 text-slate-300 border-slate-600/40",
  preseason: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  regular: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  playoffs: "bg-green-500/15 text-green-300 border-green-500/30",
};

export default function CalendarControls(p: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "err">("ok");
  const [jump, setJump] = useState(p.dateISO);

  const run = (fn: () => Promise<{ phase?: string; played?: number }>) => start(async () => {
    setMsg(null);
    try {
      const r = await fn();
      setTone("ok");
      setMsg(typeof r.played === "number" && r.played > 0
        ? `Advanced — ${r.played} game${r.played === 1 ? "" : "s"} played.`
        : "League clock updated.");
    } catch (e) { setTone("err"); setMsg((e as Error).message); }
  });

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-5 py-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <div className="text-2xl font-bold tabular-nums">{p.dateLabel}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${PHASE_TONE[p.phase] ?? PHASE_TONE.offseason}`}>
              {p.phaseLabel}
            </span>
            {p.frenzyDay > 0 && (
              <span className="text-xs text-amber-300/90 font-medium">Frenzy day {p.frenzyDay} / 7</span>
            )}
          </div>
        </div>
        {p.isAdmin && (
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <button onClick={() => run(advanceLeagueDayAction)} disabled={pending}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold">
              {pending ? "Working…" : "▶ Advance Day"}
            </button>
            <input type="date" value={jump} onChange={(e) => setJump(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm" />
            <button onClick={() => run(() => setLeagueDateAction(jump))} disabled={pending}
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold">
              Jump
            </button>
            <button onClick={() => run(startLeagueClockAction)} disabled={pending} title="Reset the clock to July 1 — Free Agent Frenzy open"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 text-sm">
              ⟲ July 1
            </button>
          </div>
        )}
      </div>
      {msg && <div className={`mt-3 text-sm ${tone === "ok" ? "text-green-300" : "text-red-300"}`}>{msg}</div>}
    </div>
  );
}
