"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePoll, useServerNow } from "./useLive";
import LiveBoard from "./LiveBoard";
import CoachPanel from "./CoachPanel";
import { describeLiveEvents, fmtClock, periodLabel, type LiveLine } from "@/lib/sim/live-text";
import type { SimEvent } from "@/lib/sim/events";

type Side = { id: number; code: string | null; name: string };
type View = {
  now: number; startsAt: number; round: number; home: Side; away: Side;
  status: "pending" | "live" | "final"; period: number; clock: number; absSeconds: number;
  score: { home: number; away: number }; shots: { home: number; away: number };
  events: SimEvent[]; cursor: number; nextChangeAt: number | null; endedIn?: string; pausedWhy: string | null; timeoutUsed: number[]; shootout: { home: number; away: number } | null;
};

type Props = {
  gameId: number;
  logos: Record<number, string>;
  home: Side; away: Side;
  coachTeams: Array<{ id: number; name: string }>;
  finalHref: string;
};

function TeamBlock({ logos, t, score, align }: { logos: Record<number, string>; t: Side; score: number | string; align: "left" | "right" }) {
  return (
    <div className={`flex-1 flex items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {logos[t.id] ? <img src={logos[t.id]} alt="" className="w-10 h-10 sm:w-16 sm:h-16 object-contain shrink-0" /> : <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0" />}
      <div className="min-w-0">
        <p className="font-bold truncate"><span className="sm:hidden">{t.code ?? t.name}</span><span className="hidden sm:inline">{t.name}</span></p>
        <p className="text-3xl sm:text-5xl font-black tabular-nums leading-none mt-1">{score}</p>
      </div>
    </div>
  );
}

export default function LiveGame({ gameId, logos, home, away, coachTeams, finalHref }: Props) {
  const [since, setSince] = useState(-1);
  const [lines, setLines] = useState<LiveLine[]>([]);
  const seen = useRef(new Set<number>());
  const { data, skewMs } = usePoll<View | { error: string }>(`/api/live/games/${gameId}?since=${since}`, 1500);
  const view = data && !("error" in data) ? data : null;
  const serverNow = useServerNow(skewMs);

  useEffect(() => {
    if (!view?.events.length) return;
    const fresh = describeLiveEvents(view.events.filter((e) => !seen.current.has(e.seq)));
    view.events.forEach((e) => seen.current.add(e.seq));
    if (fresh.length) setLines((cur) => [...cur, ...fresh]);
    if (view.cursor > since) setSince(view.cursor);
  }, [view, since]);

  const feed = useMemo(() => [...lines].reverse(), [lines]);
  const outIds = useMemo(() => [...new Set(lines.map((l) => l.outPlayerId).filter((x): x is number => x != null))], [lines]); // skaters who left this game
  const mine = coachTeams.map((t) => t.id);

  if (data && "error" in data) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-slate-300">
        <p className="font-semibold">This game isn&apos;t live right now.</p>
        <p className="text-sm text-slate-400 mt-1">It may not have started yet, or it has already finished.</p>
        <div className="flex gap-4 mt-4 text-sm"><Link href="/live" className="text-blue-400 hover:text-blue-300">Live scoreboard →</Link><Link href={finalHref} className="text-blue-400 hover:text-blue-300">Game report →</Link></div>
      </div>
    );
  }

  const countdown = view ? view.startsAt - serverNow : 0;
  const status = !view ? "Loading…" : view.status === "pending" ? `Puck drops in ${Math.max(0, Math.ceil(countdown / 1000))}s`
    : view.status === "final" ? (view.endedIn && view.endedIn !== "REG" ? `Final/${view.endedIn}` : "Final")
    : view.shootout ? `Shootout · ${view.shootout.away}–${view.shootout.home}`
    : `${periodLabel(view.period)} · ${fmtClock(view.clock)}`;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5 min-w-0">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 text-xs uppercase tracking-wide">
            <span className={view?.status === "live" ? "text-red-400 font-bold" : "text-slate-500"}>{view?.status === "live" ? "● LIVE" : ""}</span>
            <span className="text-slate-300 font-semibold text-sm normal-case tracking-normal">{status}</span>
          </div>
          <div className="flex items-center gap-3">
            <TeamBlock logos={logos} t={away} score={view && view.status !== "pending" ? view.score.away : "–"} align="left" />
            <span className="text-slate-600 text-xl sm:text-2xl">@</span>
            <TeamBlock logos={logos} t={home} score={view && view.status !== "pending" ? view.score.home : "–"} align="right" />
          </div>
          {view && view.status !== "pending" && (
            <div className="grid grid-cols-3 text-center mt-4 text-sm text-slate-400">
              <span className="tabular-nums">{view.shots.away}</span><span className="text-[11px] uppercase tracking-wide text-slate-500">Shots on goal</span><span className="tabular-nums">{view.shots.home}</span>
            </div>
          )}
        </div>

        {coachTeams.map((t) => <CoachPanel key={t.id} gameId={gameId} teamId={t.id} teamName={t.name} over={view?.status === "final"} timeoutUsed={view?.timeoutUsed.includes(t.id) ?? false} outIds={outIds} />)}

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-800/30"><h2 className="text-sm font-bold uppercase tracking-wide text-slate-200">Play-by-play</h2></div>
          <ul className="divide-y divide-slate-800/70 max-h-[28rem] overflow-y-auto">
            {feed.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">Waiting for the puck to drop…</li>}
            {feed.map((l) => (
              <li key={l.seq} className={`px-4 py-2 flex gap-3 text-sm ${l.kind === "goal" ? "bg-emerald-500/10" : l.kind === "penalty" ? "bg-amber-500/5" : ""}`}>
                <span className="text-slate-500 tabular-nums w-16 shrink-0">{l.tag ?? `${periodLabel(l.period)} ${fmtClock(l.seconds)}`}</span>
                <span className={l.major ? "font-semibold text-slate-100" : "text-slate-300"}>{l.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <aside className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tonight around the league</h2>
        <LiveBoard logos={logos} compact activeGameId={gameId} mineTeamIds={mine} />
      </aside>
    </div>
  );
}
