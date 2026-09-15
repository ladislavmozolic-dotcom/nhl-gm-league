"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { processRoundEndAction } from "@/app/free-agents/actions";
import { frenzyRoundCloseUtcMs } from "@/lib/sim-clock";

type Stage = "BIDDING" | "IMPROVEMENT" | "CONTINUOUS";

function RoundCloseTicker({ frenzyRound, frenzyDay, frenzyRoundStartedAt, stage }: {
  frenzyRound: number; frenzyDay: number; frenzyRoundStartedAt?: string | null; stage: Exclude<Stage, "CONTINUOUS">;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  if (!now) return null;
  const rem = Math.max(0, frenzyRoundCloseUtcMs(now, frenzyRound, frenzyDay, frenzyRoundStartedAt, stage) - now.getTime());
  const d = Math.floor(rem / 86_400_000);
  const h = Math.floor((rem % 86_400_000) / 3.6e6), m = Math.floor((rem % 3.6e6) / 6e4), s = Math.floor((rem % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return <span className="text-xs font-semibold text-amber-300 tabular-nums whitespace-nowrap">
    {stage === "BIDDING" ? "Offers close" : "Decision"} in {d > 0 && `${d}d `}{pad(h)}:{pad(m)}:{pad(s)}
  </span>;
}

export default function FrenzyBar({ frenzyOpen, frenzyDay, frenzyRound, frenzyStage, postFrenzyOpen = false, phaseLabel, isAdmin, inSeasonOpen = false, ownOnly = false, frenzyRoundStartedAt }: {
  frenzyOpen: boolean; frenzyDay: number; frenzyRound: number; frenzyStage: Stage; postFrenzyOpen?: boolean;
  phaseLabel: string; isAdmin: boolean; inSeasonOpen?: boolean; ownOnly?: boolean; frenzyRoundStartedAt?: string | null;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);

  const advance = () => start(async () => {
    setMsg(null);
    const r = await processRoundEndAction();
    if (!r.ok) { setMsg({ t: "err", s: r.error }); return; }
    const s = r.stage === "IMPROVEMENT"
      ? `Round ${r.round}: new offers closed — ${r.decided} player${r.decided === 1 ? "" : "s"} entered the 2-day improvement stage.`
      : r.stage === "CONTINUOUS"
        ? `Round 3 resolved — ${r.signed} player${r.signed === 1 ? "" : "s"} signed. The continuous 24-hour market is now open.`
        : `Round ${r.round} resolved — ${r.signed} player${r.signed === 1 ? "" : "s"} signed. The next round is open.`;
    setMsg({ t: "ok", s });
  });

  const active = frenzyOpen || postFrenzyOpen || inSeasonOpen;
  return (
    <div className={`rounded-xl px-4 py-3 border ${frenzyOpen ? "bg-amber-500/10 border-amber-500/30" : active ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-900/60 border-slate-800"}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${active ? "bg-amber-400 animate-pulse" : "bg-slate-600"}`} />
        <span className="text-sm font-semibold">
          {frenzyOpen ? `Market OPEN — Round ${frenzyRound} / 3 · ${frenzyStage === "IMPROVEMENT" ? "2-day improvement" : "4-day bidding"}`
            : postFrenzyOpen ? "Post-Frenzy market OPEN — 24-hour windows"
            : inSeasonOpen ? `In-season signings OPEN — ${phaseLabel}`
            : `Market closed — ${phaseLabel}`}
        </span>
        {frenzyOpen && frenzyStage !== "CONTINUOUS" && <RoundCloseTicker frenzyRound={frenzyRound} frenzyDay={frenzyDay} frenzyRoundStartedAt={frenzyRoundStartedAt} stage={frenzyStage} />}
        <span className="text-xs text-slate-500">
          {frenzyOpen
            ? frenzyStage === "IMPROVEMENT"
              ? "Only current bidders may react. The Agent evaluates the updated offers when this window ends."
              : frenzyRound === 1 ? "Round 1: every GM has four days to make a first offer."
              : frenzyRound === 2 ? "Round 2: unsigned players return immediately with softer demands."
              : "Round 3: final four-day bidding stage before the continuous market."
            : postFrenzyOpen
              ? "A first offer opens 24 hours. If another club joins, current bidders receive a final 24 hours to improve."
              : inSeasonOpen
                ? ownOnly ? "Playoffs: you may re-sign your OWN UFAs only — an acceptable offer signs on the spot."
                  : "Open market: an offer opens a 7-day window, followed by a 3-day improvement stage."
                : "Signings open at the scheduled Frenzy start."}
        </span>
        {isAdmin && <Link href="/signings" className={`text-sm font-semibold text-slate-400 hover:text-blue-400 ${frenzyOpen ? "" : "ml-auto"}`}>Signed →</Link>}
        {isAdmin && frenzyOpen && (
          <button onClick={advance} disabled={pending}
            className="ml-auto px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-sm font-semibold"
            title={frenzyStage === "BIDDING" ? "Close new bidding and start the 2-day improvement stage" : "Evaluate offers and advance the market"}>
            {pending ? "…" : frenzyStage === "BIDDING" ? `Close bidding · R${frenzyRound}` : `Resolve round ${frenzyRound}`}
          </button>
        )}
      </div>
      {msg && <div className={`mt-2 text-sm ${msg.t === "ok" ? "text-green-300" : "text-red-300"}`}>{msg.s}</div>}
    </div>
  );
}
