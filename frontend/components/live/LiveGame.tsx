"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePoll, useServerNow } from "./useLive";
import LiveBoard from "./LiveBoard";
import CoachPanel from "./CoachPanel";
import LiveRinkTracker from "./LiveRinkTracker";
import LiveBoxscore, { type LiveGoalItem, type LivePenaltyItem } from "./LiveBoxscore";
import { describeLiveEvents, fmtClock, periodLabel, type LiveLine } from "@/lib/sim/live-text";
import type { SimEvent } from "@/lib/sim/events";
import type { GoalieInfo } from "@/lib/sim/live";

type Side = { id: number; code: string | null; name: string };
type View = {
  now: number; startsAt: number; round: number; home: Side; away: Side;
  status: "pending" | "live" | "final"; period: number; clock: number; absSeconds: number;
  score: { home: number; away: number }; shots: { home: number; away: number };
  events: SimEvent[]; cursor: number; nextChangeAt: number | null; endedIn?: string; pausedWhy: string | null; timeoutUsed: number[]; goalies: { home: GoalieInfo; away: GoalieInfo }; shootout: { home: number; away: number } | null;
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
  const [eventsList, setEventsList] = useState<SimEvent[]>([]);
  const seen = useRef(new Set<number>());
  const { data, skewMs } = usePoll<View | { error: string }>(`/api/live/games/${gameId}?since=${since}`, 1500);
  const view = data && !("error" in data) ? data : null;
  const serverNow = useServerNow(skewMs);

  useEffect(() => {
    if (!view?.events.length) return;
    const freshEvents = view.events.filter((e) => !seen.current.has(e.seq));
    view.events.forEach((e) => seen.current.add(e.seq));
    if (freshEvents.length) {
      setEventsList((cur) => [...cur, ...freshEvents]);
      const freshLines = describeLiveEvents(freshEvents);
      if (freshLines.length) setLines((cur) => [...cur, ...freshLines]);
    }
    if (view.cursor > since) setSince(view.cursor);
  }, [view, since]);

  const feed = useMemo(() => [...lines].reverse(), [lines]);
  const outIds = useMemo(() => [...new Set(lines.map((l) => l.outPlayerId).filter((x): x is number => x != null))], [lines]); // skaters who left this game
  const mine = coachTeams.map((t) => t.id);

  const [showRink, setShowRink] = useState(false);
  const [showBoxscore, setShowBoxscore] = useState(true);
  const [feedTab, setFeedTab] = useState<"pbp" | "boxscore">("pbp");

  useEffect(() => {
    try {
      const savedRink = localStorage.getItem("v3_live_rink_enabled");
      if (savedRink !== null) setShowRink(savedRink === "true");
      const savedBox = localStorage.getItem("v3_live_boxscore_enabled");
      if (savedBox !== null) setShowBoxscore(savedBox === "true");
    } catch {}
  }, []);

  const toggleRink = () => {
    setShowRink((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("v3_live_rink_enabled", String(next));
      } catch {}
      return next;
    });
  };

  const toggleBoxscore = () => {
    setShowBoxscore((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("v3_live_boxscore_enabled", String(next));
      } catch {}
      return next;
    });
  };

  // Extract live goals & penalties from all accumulated events
  const liveGoals = useMemo((): LiveGoalItem[] => {
    return eventsList
      .filter((e) => e.type === "GOAL" && !(e.meta as { so?: boolean } | undefined)?.so)
      .map((e) => {
        const meta = (e.meta || {}) as { emptyNet?: boolean; assistNames?: string[]; seasonGoal?: number };
        return {
          seq: e.seq,
          period: e.period,
          seconds: e.seconds,
          teamId: e.teamId,
          teamCode: e.teamCode,
          scorerName: e.playerName || "Hráč",
          strength: e.strength || "EV",
          emptyNet: !!meta.emptyNet,
          assists: meta.assistNames || [],
          seasonGoal: meta.seasonGoal,
        };
      });
  }, [eventsList]);

  const livePenalties = useMemo((): LivePenaltyItem[] => {
    return eventsList
      .filter((e) => e.type === "PENALTY")
      .map((e) => {
        const meta = (e.meta || {}) as { penalty?: string; minutes?: number; severity?: string; givesPP?: boolean };
        return {
          seq: e.seq,
          period: e.period,
          seconds: e.seconds,
          teamId: e.teamId,
          teamCode: e.teamCode,
          playerName: e.playerName || "Hráč",
          penalty: meta.penalty || "Nedovolená hra",
          minutes: meta.minutes ?? 2,
          severity: meta.severity || "Minor",
          givesPP: meta.givesPP ?? true,
        };
      });
  }, [eventsList]);

  const livePeriods = useMemo(() => {
    const pSet = new Set<number>([1]);
    if (view && view.period > 1) {
      for (let i = 1; i <= view.period; i++) pSet.add(i);
    }
    liveGoals.forEach((g) => pSet.add(g.period));
    livePenalties.forEach((p) => pSet.add(p.period));
    return Array.from(pSet).sort((a, b) => a - b);
  }, [view, liveGoals, livePenalties]);

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
    <div className="space-y-4 w-full">
      {/* 1. TOP TICKER: Live scoreboard / Tonight around the league */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg">
        <LiveBoard logos={logos} variant="horizontal" activeGameId={gameId} mineTeamIds={mine} />
      </section>

      {/* 2. MAIN GAME HEADER / SCOREBOARD */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 text-xs uppercase tracking-wide">
          <span className={view?.status === "live" ? "text-red-400 font-bold" : "text-slate-500"}>{view?.status === "live" ? "● LIVE" : ""}</span>
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {/* Boxscore toggle button */}
            <button
              onClick={toggleBoxscore}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition border ${
                showBoxscore
                  ? "bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm shadow-emerald-900"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
              title="Prepnúť zobrazenie Boxscore (góly a vylúčenia)"
            >
              <span>📊 Boxscore:</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${showBoxscore ? "bg-emerald-500 text-slate-950 font-black" : "bg-slate-700 text-slate-300"}`}>
                {showBoxscore ? "ZAP" : "VYP"}
              </span>
            </button>

            {/* 2D Rink toggle button */}
            <button
              onClick={toggleRink}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition border ${
                showRink
                  ? "bg-sky-950 text-sky-300 border-sky-600 shadow-sm shadow-sky-900"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
              title="Prepnúť vizuálne 2D klzisko (EHM štýl)"
            >
              <span>🏒 2D Klzisko:</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${showRink ? "bg-sky-500 text-slate-950 font-black" : "bg-slate-700 text-slate-300"}`}>
                {showRink ? "ZAP" : "VYP"}
              </span>
            </button>
            <span className="text-slate-300 font-semibold text-sm normal-case tracking-normal">{status}</span>
          </div>
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

      {/* 3. 2D RINK TRACKER */}
      {showRink && (
        <LiveRinkTracker
          gameId={gameId}
          homeTeamId={home.id}
          awayTeamId={away.id}
          homeTeamName={home.name}
          awayTeamName={away.name}
          homeLogoUrl={logos[home.id] || ""}
          awayLogoUrl={logos[away.id] || ""}
          homeScore={view && view.status !== "pending" ? view.score.home : 0}
          awayScore={view && view.status !== "pending" ? view.score.away : 0}
          homeSog={view && view.status !== "pending" ? view.shots.home : 0}
          awaySog={view && view.status !== "pending" ? view.shots.away : 0}
          periodStr={view ? periodLabel(view.period) : "1. Tretina"}
          clockStr={view ? fmtClock(view.clock) : "20:00"}
          isLive={view?.status === "live"}
          standaloneControls={false}
          events={view?.events ?? []}
        />
      )}

      {/* 4. LIVE BOXSCORE CARD (GÓLY & VYLÚČENIA) */}
      {showBoxscore && (
        <LiveBoxscore
          periods={livePeriods}
          goals={liveGoals}
          penalties={livePenalties}
          home={home}
          away={away}
          logos={logos}
        />
      )}

      {/* 5. COACH PANEL */}
      {coachTeams.map((t) => <CoachPanel key={t.id} gameId={gameId} teamId={t.id} teamName={t.name} over={view?.status === "final"} timeoutUsed={view?.timeoutUsed.includes(t.id) ?? false} outIds={outIds} goalies={view ? (view.goalies.home.teamId === t.id ? view.goalies.home : view.goalies.away) : undefined} />)}

      {/* 6. PLAY-BY-PLAY / BOXSCORE TABS */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFeedTab("pbp")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                feedTab === "pbp"
                  ? "bg-sky-600 text-white shadow-sm shadow-sky-900"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>📝 Play-by-play</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-mono">
                {feed.length}
              </span>
            </button>
            <button
              onClick={() => setFeedTab("boxscore")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                feedTab === "boxscore"
                  ? "bg-sky-600 text-white shadow-sm shadow-sky-900"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>📊 Boxscore</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-mono">
                {liveGoals.length}G · {livePenalties.length}P
              </span>
            </button>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {feedTab === "pbp" ? "Živý textový prenos" : "Zápis gólov a trestov"}
          </span>
        </div>

        {feedTab === "pbp" ? (
          <ul className="divide-y divide-slate-800/70 max-h-[28rem] overflow-y-auto">
            {feed.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">Waiting for the puck to drop…</li>}
            {feed.map((l) => (
              <li key={l.seq} className={`px-4 py-2 flex gap-3 text-sm ${l.kind === "goal" ? "bg-emerald-500/10" : l.kind === "penalty" ? "bg-amber-500/5" : ""}`}>
                <span className="text-slate-500 tabular-nums w-16 shrink-0">{l.tag ?? `${periodLabel(l.period)} ${fmtClock(l.seconds)}`}</span>
                <span className={l.major ? "font-semibold text-slate-100" : "text-slate-300"}>{l.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-3 sm:p-4">
            <LiveBoxscore
              periods={livePeriods}
              goals={liveGoals}
              penalties={livePenalties}
              home={home}
              away={away}
              logos={logos}
            />
          </div>
        )}
      </div>
    </div>
  );
}
