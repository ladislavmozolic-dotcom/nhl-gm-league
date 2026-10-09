"use client";

import Link from "next/link";
import { usePoll, useServerNow } from "./useLive";

type Row = {
  gameId: number; league: string | null;
  home: { id: number; code: string | null; name: string }; away: { id: number; code: string | null; name: string };
  status: "pending" | "live" | "final"; period: number; clock: number;
  score: { home: number; away: number }; shots: { home: number; away: number }; endedIn?: string;
  shootout: { home: number; away: number } | null;
};
type Board = { now: number; live: { round: number; title: string; playoff: boolean; season: string; startsAt: number; status: "running" | "finished"; games: Row[] } | null };

const clock = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
const per = (p: number) => (p <= 3 ? `${p}${["st", "nd", "rd"][p - 1]}` : p === 4 ? "OT" : `${p - 3}OT`);

function statusText(r: Row) {
  if (r.status === "pending") return "Starting soon";
  if (r.status === "live" && r.shootout) return `Shootout ${r.shootout.away}–${r.shootout.home}`;
  if (r.status === "final") return r.endedIn && r.endedIn !== "REG" ? `Final/${r.endedIn}` : "Final";
  return r.clock <= 0.5 && r.period > 1 ? `Start ${per(r.period)}` : `${per(r.period)} ${clock(r.clock)}`;
}

/** The live scoreboard — every game of tonight's round at once. `compact` is the slim strip used beside a game. */
export default function LiveBoard({ logos, activeGameId, compact = false, mineTeamIds = [] }: { logos: Record<number, string>; activeGameId?: number; compact?: boolean; mineTeamIds?: number[] }) {
  const { data, skewMs } = usePoll<Board>("/api/live/scoreboard", 2000);
  const serverNow = useServerNow(skewMs);
  const live = data?.live;
  if (!data) return <p className="text-sm text-slate-500">Loading scoreboard…</p>;
  if (!live) return <p className="text-sm text-slate-400">No round is being played live right now.</p>;
  const countdown = live.startsAt - serverNow;
  const games = [...live.games].sort((a, b) => Number((b.league ?? "NHL") === "NHL") - Number((a.league ?? "NHL") === "NHL"));
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{live.playoff ? "🏆 " : ""}{live.title}</p>
      {countdown > 0 && <p className="mb-3 text-sm text-amber-300">Puck drops in {Math.ceil(countdown / 1000)}s</p>}
      <div className={compact ? "flex flex-col gap-1.5" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
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
                    <span className={`truncate ${compact ? "text-sm" : "font-semibold"}`}>{compact ? (t.code ?? t.name) : t.name}</span>
                  </span>
                  <span className="text-lg font-black tabular-nums">{g.status === "pending" ? "–" : g.score[side]}</span>
                </div>
              ))}
              {!compact && g.status !== "pending" && <p className="text-[11px] text-slate-500 mt-1">SOG {g.shots.away}–{g.shots.home}</p>}
            </Link>
          );
        })}
      </div>
      {live.status === "finished" && <p className="mt-3 text-xs text-slate-500">All games are final — results are now in the standings and stats.</p>}
    </div>
  );
}
