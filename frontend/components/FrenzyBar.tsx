"use client";

import { useState, useTransition } from "react";
import { resolveFrenzyAction, processRoundEndAction } from "@/app/free-agents/actions";

export default function FrenzyBar({ frenzyOpen, frenzyDay, frenzyRound, phaseLabel, isAdmin, inSeasonOpen = false, ownOnly = false }: {
  frenzyOpen: boolean; frenzyDay: number; frenzyRound: number; phaseLabel: string; isAdmin: boolean;
  inSeasonOpen?: boolean; ownOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);

  const resolve = () => start(async () => {
    setMsg(null);
    const r = await resolveFrenzyAction();
    if (!r.ok) { setMsg({ t: "err", s: r.error }); return; }
    setMsg({ t: "ok", s: r.signed > 0 ? `${r.signed} player${r.signed === 1 ? "" : "s"} signed: ${r.details.slice(0, 6).join(", ")}${r.details.length > 6 ? "…" : ""}` : "No players had a good enough offer to sign." });
  });

  const advanceRound = () => start(async () => {
    setMsg(null);
    const r = await processRoundEndAction();
    if (!r.ok) { setMsg({ t: "err", s: r.error }); return; }
    setMsg({ t: "ok", s: r.round === 1
      ? `Round 1 closed — ${r.countered} counter-offer${r.countered === 1 ? "" : "s"} sent, ${r.eliminated} lowball${r.eliminated === 1 ? "" : "s"} dropped.`
      : `Round 2 closed — ${r.shortlisted} offer${r.shortlisted === 1 ? "" : "s"} shortlisted, ${r.eliminated} club${r.eliminated === 1 ? "" : "s"} told he's moving on.` });
  });

  return (
    <div className={`rounded-xl px-4 py-3 border ${frenzyOpen ? "bg-amber-500/10 border-amber-500/30" : inSeasonOpen ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-900/60 border-slate-800"}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${frenzyOpen ? "bg-amber-400 animate-pulse" : inSeasonOpen ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
        <span className="text-sm font-semibold">
          {frenzyOpen ? `Market OPEN — Round ${frenzyRound} / 3 (day ${frenzyDay}/21)`
            : inSeasonOpen ? `In-season signings OPEN — ${phaseLabel}`
            : `Market closed — ${phaseLabel}`}
        </span>
        <span className="text-xs text-slate-500">
          {frenzyOpen
            ? (frenzyRound <= 1 ? "Week 1: players ask high — table offers to open the bidding."
              : frenzyRound === 2 ? "Week 2: asks are softening — sharpen your offer."
              : "Final week: best offer (money + role + team) wins at close.")
            : inSeasonOpen
              ? (ownOnly ? "Playoffs: you may re-sign your OWN UFAs only — an acceptable offer signs on the spot."
                : "Sign your own UFAs and the open market — an acceptable offer signs immediately.")
              : "Signings open July 1 (advance the League Calendar)."}
        </span>
        {isAdmin && frenzyOpen && (
          <div className="ml-auto flex items-center gap-2">
            {frenzyRound < 3 && (
              <button onClick={advanceRound} disabled={pending}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold"
                title="Close this round: players counter (after week 1) or shortlist their suitors (after week 2)">
                {pending ? "…" : `Close round ${frenzyRound} →`}
              </button>
            )}
            <button onClick={resolve} disabled={pending}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-sm font-semibold"
              title="Sign every player's best standing offer now">
              {pending ? "Resolving…" : "Resolve signings now"}
            </button>
          </div>
        )}
      </div>
      {msg && <div className={`mt-2 text-sm ${msg.t === "ok" ? "text-green-300" : "text-red-300"}`}>{msg.s}</div>}
    </div>
  );
}
