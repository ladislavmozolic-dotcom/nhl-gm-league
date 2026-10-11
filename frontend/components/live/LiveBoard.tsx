"use client";

import Link from "next/link";
import { usePoll, useServerNow } from "./useLive";
import { fmtRemainingClock } from "@/lib/sim/live-text";

type Row = {
  gameId: number; league: string | null;
  home: { id: number; code: string | null; name: string }; away: { id: number; code: string | null; name: string };
  status: "pending" | "live" | "final"; period: number; clock: number;
  score: { home: number; away: number }; shots: { home: number; away: number }; endedIn?: string;
  shootout: { home: number; away: number } | null;
};
type Board = { now: number; live: { round: number; title: string; playoff: boolean; season: string; startsAt: number; status: "running" | "finished"; games: Row[] } | null };

const per = (p: number) => (p <= 3 ? `${p}${["st", "nd", "rd"][p - 1]}` : p === 4 ? "OT" : `${p - 3}OT`);

function statusText(r: Row) {
  if (r.status === "pending") return "Starting soon";
  if (r.status === "live" && r.shootout) return `Shootout ${r.shootout.away}–${r.shootout.home}`;
  if (r.status === "final") return r.endedIn && r.endedIn !== "REG" ? `Final/${r.endedIn}` : "Final";
  return r.clock <= 0.5 && r.period > 1 ? `Start ${per(r.period)}` : `${per(r.period)} ${fmtRemainingClock(r.clock, r.period)}`;
}

/** The live scoreboard — every game of tonight's round at once. Supports grid, vertical (sidebar) and horizontal (top ticker). */
export default function LiveBoard({
  logos,
  activeGameId,
  compact = false,
  variant,
  mineTeamIds = []
}: {
  logos: Record<number, string>;
  activeGameId?: number;
  compact?: boolean;
  variant?: "grid" | "vertical" | "horizontal";
  mineTeamIds?: number[];
}) {
  const mode = variant ?? (compact ? "vertical" : "grid");
  const { data, skewMs } = usePoll<Board>("/api/live/scoreboard", 2000);
  const serverNow = useServerNow(skewMs);
  const live = data?.live;
  if (!data) return <p className="text-sm text-slate-500">Loading scoreboard…</p>;
  if (!live) return mode === "horizontal" ? null : <p className="text-sm text-slate-400">No round is being played live right now.</p>;
  const countdown = live.startsAt - serverNow;
  const games = [...live.games].sort((a, b) => Number((b.league ?? "NHL") === "NHL") - Number((a.league ?? "NHL") === "NHL"));

  if (mode === "horizontal") {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>{live.playoff ? "🏆 " : "🏒 "}{live.title}</span>
            {countdown > 0 && <span className="text-amber-400 font-semibold lowercase tracking-normal">· začína o {Math.ceil(countdown / 1000)}s</span>}
          </div>
          <Link href="/live" className="text-[11px] text-sky-400 hover:text-sky-300 font-medium">
            Všetky zápasy →
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
          {games.map((g) => {
            const mine = mineTeamIds.includes(g.home.id) || mineTeamIds.includes(g.away.id);
            const isActive = g.gameId === activeGameId;
            return (
              <Link
                key={g.gameId}
                href={`/live/${g.gameId}`}
                className={`block min-w-[150px] sm:min-w-[170px] max-w-[195px] shrink-0 rounded-xl border px-2.5 py-1.5 transition-all ${
                  isActive
                    ? "border-sky-500 bg-sky-950/60 ring-1 ring-sky-500 shadow-md shadow-sky-950"
                    : mine
                    ? "border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20"
                    : "border-slate-800 bg-slate-900/90 hover:bg-slate-800/90 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1 font-bold">
                  <span className={g.status === "live" ? "text-red-400 flex items-center gap-1" : "text-slate-500"}>
                    {g.status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                    {g.status === "live" ? "LIVE" : ""}{g.league === "AHL" ? " · AHL" : ""}
                  </span>
                  <span className={g.status === "live" ? "text-amber-300 font-mono" : "text-slate-400 font-mono"}>{statusText(g)}</span>
                </div>
                {([["away", g.away], ["home", g.home]] as const).map(([side, t]) => (
                  <div key={side} className="flex items-center justify-between gap-1.5 py-0.5">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {logos[t.id] ? (
                        <img src={logos[t.id]} alt="" className="w-4 h-4 object-contain shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-slate-800 shrink-0" />
                      )}
                      <span className={`truncate text-xs ${isActive ? "font-bold text-sky-200" : "font-semibold text-slate-200"}`}>
                        {t.code ?? t.name}
                      </span>
                    </span>
                    <span className={`text-sm font-black font-mono tabular-nums ${isActive ? "text-sky-300" : "text-white"}`}>
                      {g.status === "pending" ? "–" : g.score[side]}
                    </span>
                  </div>
                ))}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{live.playoff ? "🏆 " : ""}{live.title}</p>
      {countdown > 0 && <p className="mb-3 text-sm text-amber-300">Puck drops in {Math.ceil(countdown / 1000)}s</p>}
      <div className={mode === "vertical" ? "flex flex-col gap-1.5" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
        {games.map((g) => {
          const mine = mineTeamIds.includes(g.home.id) || mineTeamIds.includes(g.away.id);
          return (
            <Link key={g.gameId} href={`/live/${g.gameId}`}
              className={`block rounded-xl border px-3 py-2.5 transition-colors ${g.gameId === activeGameId ? "border-blue-500 bg-blue-500/10" : mine ? "border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10" : "border-slate-800 bg-slate-900/70 hover:bg-slate-800/60"}`}>
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide mb-1.5">
                <span className={g.status === "live" ? "text-red-400 font-bold" : "text-slate-500"}>{g.status === "live" ? "● LIVE" : ""}{g.league === "AHL" ? " AHL" : ""}</span>
                <span className="text-slate-400">{statusText(g)}</span>
              </div>
              {([["away", g.away], ["home", g.home]] as const).map(([side, t]) => (
                <div key={side} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="flex items-center gap-2 min-w-0">
                    {logos[t.id] ? <img src={logos[t.id]} alt="" className="w-5 h-5 object-contain shrink-0" /> : <span className="w-5 h-5 rounded-full bg-slate-800 shrink-0" />}
                    <span className={`truncate ${mode === "vertical" ? "text-sm" : "font-semibold"}`}>{mode === "vertical" ? (t.code ?? t.name) : t.name}</span>
                  </span>
                  <span className="text-lg font-black tabular-nums">{g.status === "pending" ? "–" : g.score[side]}</span>
                </div>
              ))}
              {mode !== "vertical" && g.status !== "pending" && <p className="text-[11px] text-slate-500 mt-1">SOG {g.shots.away}–{g.shots.home}</p>}
            </Link>
          );
        })}
      </div>
      {live.status === "finished" && <p className="mt-3 text-xs text-slate-500">All games are final — results are now in the standings and stats.</p>}
    </div>
  );
}
