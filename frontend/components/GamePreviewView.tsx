"use client";

import { useState } from "react";
import Link from "next/link";
import { cleanName } from "@/lib/playerName";
import PlayerAvatar from "@/components/playerAvatar";

export type MatchPreviewData = {
  gameId: number;
  season: string;
  league: string;
  gameDate: string | null;
  round: number | null;
  status: string;
  homeTeam: {
    id: number;
    name: string;
    code: string;
    slug: string;
    logoUrl: string | null;
    conference: string | null;
    division: string | null;
    arena: string | null;
    standing?: { gp: number; w: number; l: number; otl: number; pts: number; rank: number; confRank: number; gf: number; ga: number; diff: number; streak: string } | null;
  };
  awayTeam: {
    id: number;
    name: string;
    code: string;
    slug: string;
    logoUrl: string | null;
    conference: string | null;
    division: string | null;
    arena: string | null;
    standing?: { gp: number; w: number; l: number; otl: number; pts: number; rank: number; confRank: number; gf: number; ga: number; diff: number; streak: string } | null;
  };
  startingGoalies: {
    home: {
      starter: { id: number; name: string; slug: string | null; overall: number; age?: number; catches?: string; photoUrl?: string | null; stats?: { gp: number; w: number; l: number; otl: number; gaa: number; svPct: number; shutouts: number } } | null;
      backup: { id: number; name: string; slug: string | null; overall: number; age?: number; catches?: string; photoUrl?: string | null; stats?: { gp: number; w: number; l: number; otl: number; gaa: number; svPct: number; shutouts: number } } | null;
    };
    away: {
      starter: { id: number; name: string; slug: string | null; overall: number; age?: number; catches?: string; photoUrl?: string | null; stats?: { gp: number; w: number; l: number; otl: number; gaa: number; svPct: number; shutouts: number } } | null;
      backup: { id: number; name: string; slug: string | null; overall: number; age?: number; catches?: string; photoUrl?: string | null; stats?: { gp: number; w: number; l: number; otl: number; gaa: number; svPct: number; shutouts: number } } | null;
    };
  };
  topScorers: {
    home: Array<{ id: number; name: string; slug: string | null; position: string; number: number | null; overall: number; gp: number; goals: number; assists: number; points: number; plusMinus: number }>;
    away: Array<{ id: number; name: string; slug: string | null; position: string; number: number | null; overall: number; gp: number; goals: number; assists: number; points: number; plusMinus: number }>;
  };
  recentForm: {
    home: Array<{ gameId: number; isHome: boolean; oppCode: string; oppName: string; oppLogo: string | null; goalsFor: number; goalsAgainst: number; result: string; endedIn: string; date: string }>;
    away: Array<{ gameId: number; isHome: boolean; oppCode: string; oppName: string; oppLogo: string | null; goalsFor: number; goalsAgainst: number; result: string; endedIn: string; date: string }>;
  };
  h2h: Array<{ gameId: number; homeTeamCode: string; homeTeamLogo: string | null; homeGoals: number; awayTeamCode: string; awayTeamLogo: string | null; awayGoals: number; endedIn: string; date: string }>;
  tactics: {
    home: { preset?: string; tempo: string; forecheck: string; puckStyle: string; dZone: string; ppStyle?: string; pkStyle?: string };
    away: { preset?: string; tempo: string; forecheck: string; puckStyle: string; dZone: string; ppStyle?: string; pkStyle?: string };
  };
  lines?: {
    home: Array<{ title: string; cols: string[]; units: Array<{ n: number; players: Array<{ id: number; name: string; slug: string | null; pos?: string } | null>; tactic?: { phy: number; df: number; of: number } }> }>;
    away: Array<{ title: string; cols: string[]; units: Array<{ n: number; players: Array<{ id: number; name: string; slug: string | null; pos?: string } | null>; tactic?: { phy: number; df: number; of: number } }> }>;
  };
  userTeamId?: number | null;
};

export default function GamePreviewView({ data }: { data: MatchPreviewData }) {
  const [tab, setTab] = useState<"overview" | "lines" | "comparison">("overview");

  const isUserHome = data.userTeamId === data.homeTeam.id;
  const isUserAway = data.userTeamId === data.awayTeam.id;

  const fmtDate = (dStr: string | null) => {
    if (!dStr) return "TBD";
    const d = new Date(dStr);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  };

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-6 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800"
        >
          <span>←</span> Back to Schedule
        </Link>
        <div className="flex items-center gap-2">
          {(isUserHome || isUserAway) && (
            <Link
              href={`/teams/${isUserHome ? data.homeTeam.slug : data.awayTeam.slug}/lines`}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-300 hover:text-white transition-colors bg-emerald-950/60 hover:bg-emerald-900/80 px-3.5 py-1.5 rounded-xl border border-emerald-700/50 shadow-sm"
            >
              <span>⚙️</span> Edit Your Lines
            </Link>
          )}
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-950 text-blue-400 border border-blue-800/60">
            MATCH PREVIEW
          </span>
        </div>
      </div>

      {/* Matchup Hero Header */}
      <div className="bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-500 opacity-70"></div>
        
        <div className="text-center mb-6">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400">
            {data.league} · {data.season} · Round {data.round ?? "—"}
          </p>
          <h1 className="text-base sm:text-lg text-slate-300 font-medium mt-1">
            {fmtDate(data.gameDate)} {data.homeTeam.arena ? `· ${data.homeTeam.arena}` : ""}
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-11 items-center gap-6">
          {/* Away Team */}
          <div className="md:col-span-5 flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-4 text-center sm:text-right">
            <div>
              <Link href={`/teams/${data.awayTeam.slug}`} className="hover:underline">
                <h2 className="text-xl sm:text-2xl font-black text-white">{data.awayTeam.name}</h2>
              </Link>
              <div className="flex items-center justify-center sm:justify-end gap-2 text-xs font-bold text-slate-400 mt-1">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50">AWAY</span>
                {data.awayTeam.standing ? (
                  <span>
                    {data.awayTeam.standing.w}-{data.awayTeam.standing.l}-{data.awayTeam.standing.otl} ({data.awayTeam.standing.pts} PTS)
                  </span>
                ) : <span>0-0-0</span>}
              </div>
              {data.awayTeam.standing && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  #{data.awayTeam.standing.rank} League · #{data.awayTeam.standing.confRank} {data.awayTeam.conference ?? "Conf"}
                </p>
              )}
            </div>
            {data.awayTeam.logoUrl ? (
              <img src={data.awayTeam.logoUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-300">
                {data.awayTeam.code}
              </div>
            )}
          </div>

          {/* VS Divider */}
          <div className="md:col-span-1 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-slate-300 shadow-inner">
              VS
            </div>
          </div>

          {/* Home Team */}
          <div className="md:col-span-5 flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-4 text-center sm:text-left">
            {data.homeTeam.logoUrl ? (
              <img src={data.homeTeam.logoUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-300">
                {data.homeTeam.code}
              </div>
            )}
            <div>
              <Link href={`/teams/${data.homeTeam.slug}`} className="hover:underline">
                <h2 className="text-xl sm:text-2xl font-black text-white">{data.homeTeam.name}</h2>
              </Link>
              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold text-slate-400 mt-1">
                <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">HOME</span>
                {data.homeTeam.standing ? (
                  <span>
                    {data.homeTeam.standing.w}-{data.homeTeam.standing.l}-{data.homeTeam.standing.otl} ({data.homeTeam.standing.pts} PTS)
                  </span>
                ) : <span>0-0-0</span>}
              </div>
              {data.homeTeam.standing && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  #{data.homeTeam.standing.rank} League · #{data.homeTeam.standing.confRank} {data.homeTeam.conference ?? "Conf"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mt-8 border-t border-slate-800/80 pt-4">
          <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setTab("overview")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tab === "overview" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Overview & Matchup
            </button>
            <button
              onClick={() => setTab("lines")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tab === "lines" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Projected Lines
            </button>
            <button
              onClick={() => setTab("comparison")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tab === "comparison" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Tactics & Stats
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Starting Goalies Duel */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-200 flex items-center gap-2">
                <span>🧤</span> Projected Starting Goalies
              </h3>
              <span className="text-xs text-slate-400">Based on active lines &amp; readiness</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Away Goalie */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {data.awayTeam.logoUrl && <img src={data.awayTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                    <span className="text-xs font-bold text-slate-400 uppercase">{data.awayTeam.code} Goaltender</span>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                    STARTER
                  </span>
                </div>

                {data.startingGoalies.away.starter ? (
                  <div className="flex items-center gap-3 mt-3">
                    <div className="relative">
                      <PlayerAvatar
                        src={data.startingGoalies.away.starter.photoUrl ?? null}
                        alt={data.startingGoalies.away.starter.name}
                        size={56}
                      />
                      <span className="absolute -bottom-1 -right-1 bg-blue-600 text-[10px] font-black text-white px-1.5 py-0.2 rounded-full shadow">
                        {data.startingGoalies.away.starter.overall}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate">
                        {data.startingGoalies.away.starter.slug ? (
                          <Link href={`/players/${data.startingGoalies.away.starter.slug}`} className="hover:text-blue-400">
                            {data.startingGoalies.away.starter.name}
                          </Link>
                        ) : data.startingGoalies.away.starter.name}
                      </div>
                      {data.startingGoalies.away.starter.stats ? (
                        <div className="grid grid-cols-4 gap-2 text-center mt-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <div>
                            <p className="text-[10px] text-slate-400">GP</p>
                            <p className="text-xs font-bold text-slate-200">{data.startingGoalies.away.starter.stats.gp}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400">REC</p>
                            <p className="text-xs font-bold text-slate-200">{data.startingGoalies.away.starter.stats.w}-{data.startingGoalies.away.starter.stats.l}-{data.startingGoalies.away.starter.stats.otl}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400">GAA</p>
                            <p className="text-xs font-bold text-emerald-400">{data.startingGoalies.away.starter.stats.gaa.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400">SV%</p>
                            <p className="text-xs font-bold text-emerald-400">{(data.startingGoalies.away.starter.stats.svPct * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">No season appearances yet.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-3">No starter designated.</p>
                )}

                {data.startingGoalies.away.backup && (
                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <span>Backup: <span className="text-slate-300 font-medium">{data.startingGoalies.away.backup.name}</span></span>
                    <span className="text-slate-400 font-bold">{data.startingGoalies.away.backup.overall} OVR</span>
                  </div>
                )}
              </div>

              {/* Home Goalie */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {data.homeTeam.logoUrl && <img src={data.homeTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                    <span className="text-xs font-bold text-slate-400 uppercase">{data.homeTeam.code} Goaltender</span>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                    STARTER
                  </span>
                </div>

                {data.startingGoalies.home.starter ? (
                  <div className="flex items-center gap-3 mt-3">
                    <div className="relative">
                      <PlayerAvatar
                        src={data.startingGoalies.home.starter.photoUrl ?? null}
                        alt={data.startingGoalies.home.starter.name}
                        size={56}
                      />
                      <span className="absolute -bottom-1 -right-1 bg-blue-600 text-[10px] font-black text-white px-1.5 py-0.2 rounded-full shadow">
                        {data.startingGoalies.home.starter.overall}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate">
                        {data.startingGoalies.home.starter.slug ? (
                          <Link href={`/players/${data.startingGoalies.home.starter.slug}`} className="hover:text-blue-400">
                            {data.startingGoalies.home.starter.name}
                          </Link>
                        ) : data.startingGoalies.home.starter.name}
                      </div>
                      {data.startingGoalies.home.starter.stats ? (
                        <div className="grid grid-cols-4 gap-2 text-center mt-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <div>
                            <p className="text-[10px] text-slate-400">GP</p>
                            <p className="text-xs font-bold text-slate-200">{data.startingGoalies.home.starter.stats.gp}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400">REC</p>
                            <p className="text-xs font-bold text-slate-200">{data.startingGoalies.home.starter.stats.w}-{data.startingGoalies.home.starter.stats.l}-{data.startingGoalies.home.starter.stats.otl}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400">GAA</p>
                            <p className="text-xs font-bold text-emerald-400">{data.startingGoalies.home.starter.stats.gaa.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400">SV%</p>
                            <p className="text-xs font-bold text-emerald-400">{(data.startingGoalies.home.starter.stats.svPct * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">No season appearances yet.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-3">No starter designated.</p>
                )}

                {data.startingGoalies.home.backup && (
                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <span>Backup: <span className="text-slate-300 font-medium">{data.startingGoalies.home.backup.name}</span></span>
                    <span className="text-slate-400 font-bold">{data.startingGoalies.home.backup.overall} OVR</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Scorers & Leaders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Away Leaders */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  {data.awayTeam.logoUrl && <img src={data.awayTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-200">
                    {data.awayTeam.code} Top Scorers
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">PTS (G+A)</span>
              </div>

              {data.topScorers.away.length > 0 ? (
                <div className="space-y-2">
                  {data.topScorers.away.map((s, idx) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/30 border border-slate-800/60 hover:bg-slate-800/60 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className={`w-5 text-center text-xs font-black ${idx === 0 ? "text-amber-400" : "text-slate-500"}`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-100 truncate">
                            {s.slug ? <Link href={`/players/${s.slug}`} className="hover:text-blue-400">{s.name}</Link> : s.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {s.position} · {s.overall} OVR · {s.gp} GP
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-amber-300 tabular-nums">
                          {s.points} <span className="text-[10px] font-semibold text-slate-400">PTS</span>
                        </span>
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          {s.goals}G, {s.assists}A ({s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">No season stats recorded yet.</p>
              )}
            </div>

            {/* Home Leaders */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  {data.homeTeam.logoUrl && <img src={data.homeTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-200">
                    {data.homeTeam.code} Top Scorers
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">PTS (G+A)</span>
              </div>

              {data.topScorers.home.length > 0 ? (
                <div className="space-y-2">
                  {data.topScorers.home.map((s, idx) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/30 border border-slate-800/60 hover:bg-slate-800/60 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className={`w-5 text-center text-xs font-black ${idx === 0 ? "text-amber-400" : "text-slate-500"}`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-100 truncate">
                            {s.slug ? <Link href={`/players/${s.slug}`} className="hover:text-blue-400">{s.name}</Link> : s.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {s.position} · {s.overall} OVR · {s.gp} GP
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-amber-300 tabular-nums">
                          {s.points} <span className="text-[10px] font-semibold text-slate-400">PTS</span>
                        </span>
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          {s.goals}G, {s.assists}A ({s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">No season stats recorded yet.</p>
              )}
            </div>
          </div>

          {/* Recent Form (Last 5 Games) */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-200 flex items-center gap-2">
                <span>📊</span> Recent Form (Last 5 Games)
              </h3>
              <span className="text-xs text-slate-400">Results &amp; scores</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Away Form */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                  {data.awayTeam.logoUrl && <img src={data.awayTeam.logoUrl} alt="" className="w-4 h-4 object-contain" />}
                  {data.awayTeam.name}
                </p>
                {data.recentForm.away.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.recentForm.away.map((g) => (
                      <Link
                        key={g.gameId}
                        href={`/games/${g.gameId}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                              g.result === "W"
                                ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/60"
                                : g.result === "OTW"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                                : g.result === "OTL"
                                ? "bg-amber-950 text-amber-300 border border-amber-800/60"
                                : "bg-rose-950/80 text-rose-300 border border-rose-800/60"
                            }`}
                          >
                            {g.result}
                          </span>
                          <span className="text-xs text-slate-400">{g.isHome ? "vs" : "@"}</span>
                          {g.oppLogo && <img src={g.oppLogo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                          <span className="text-xs font-semibold text-slate-200 truncate">{g.oppCode}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-bold text-slate-200 tabular-nums">
                            {g.goalsFor}–{g.goalsAgainst} {g.endedIn !== "REG" && <span className="text-[10px] text-slate-400">({g.endedIn})</span>}
                          </span>
                          <span className="text-[10px] text-slate-400">{g.date}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2">No prior games this season.</p>
                )}
              </div>

              {/* Home Form */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                  {data.homeTeam.logoUrl && <img src={data.homeTeam.logoUrl} alt="" className="w-4 h-4 object-contain" />}
                  {data.homeTeam.name}
                </p>
                {data.recentForm.home.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.recentForm.home.map((g) => (
                      <Link
                        key={g.gameId}
                        href={`/games/${g.gameId}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                              g.result === "W"
                                ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/60"
                                : g.result === "OTW"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                                : g.result === "OTL"
                                ? "bg-amber-950 text-amber-300 border border-amber-800/60"
                                : "bg-rose-950/80 text-rose-300 border border-rose-800/60"
                            }`}
                          >
                            {g.result}
                          </span>
                          <span className="text-xs text-slate-400">{g.isHome ? "vs" : "@"}</span>
                          {g.oppLogo && <img src={g.oppLogo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                          <span className="text-xs font-semibold text-slate-200 truncate">{g.oppCode}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-bold text-slate-200 tabular-nums">
                            {g.goalsFor}–{g.goalsAgainst} {g.endedIn !== "REG" && <span className="text-[10px] text-slate-400">({g.endedIn})</span>}
                          </span>
                          <span className="text-[10px] text-slate-400">{g.date}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2">No prior games this season.</p>
                )}
              </div>
            </div>

            {/* H2H this season */}
            {data.h2h.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-800">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5">
                  ⚔️ Head-to-Head This Season
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {data.h2h.map((h) => (
                    <Link
                      key={h.gameId}
                      href={`/games/${h.gameId}`}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {h.awayTeamLogo && <img src={h.awayTeamLogo} alt="" className="w-4 h-4 object-contain" />}
                        <span className="font-bold text-slate-200">{h.awayTeamCode}</span>
                        <span className="font-extrabold text-white">{h.awayGoals}</span>
                        <span className="text-slate-500">@</span>
                        <span className="font-extrabold text-white">{h.homeGoals}</span>
                        <span className="font-bold text-slate-200">{h.homeTeamCode}</span>
                        {h.homeTeamLogo && <img src={h.homeTeamLogo} alt="" className="w-4 h-4 object-contain" />}
                      </div>
                      <span className="text-[10px] text-slate-400">{h.date}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROJECTED LINES */}
      {tab === "lines" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Away Lines */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  {data.awayTeam.logoUrl && <img src={data.awayTeam.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{data.awayTeam.name} Lines</h3>
                    <p className="text-[10px] text-slate-400">Active lineup configuration</p>
                  </div>
                </div>
                {isUserAway && (
                  <Link href={`/teams/${data.awayTeam.slug}/lines`} className="text-xs text-blue-400 hover:underline">
                    Edit Lines →
                  </Link>
                )}
              </div>

              {data.lines?.away && data.lines.away.length > 0 ? (
                <div className="space-y-4">
                  {data.lines.away.map((grp, gIdx) => (
                    <div key={gIdx} className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-800/60 pb-1">
                        {grp.title}
                      </p>
                      <div className="space-y-1.5">
                        {grp.units.map((unit) => (
                          <div key={unit.n} className="flex items-center gap-2 text-xs">
                            <span className="w-5 text-[10px] font-bold text-slate-500">{unit.n}.</span>
                            <div className="flex-1 grid grid-cols-3 gap-1">
                              {unit.players.map((p, pIdx) => (
                                <div key={pIdx} className="truncate bg-slate-900 px-2 py-1 rounded text-[11px] text-slate-200 border border-slate-800">
                                  {p ? (p.slug ? <Link href={`/players/${p.slug}`} className="hover:text-blue-400">{cleanName(p.name)}</Link> : cleanName(p.name)) : <span className="text-slate-600">—</span>}
                                </div>
                              ))}
                            </div>
                            {unit.tactic && (
                              <span className="text-[9px] font-mono text-slate-500 shrink-0">
                                P{unit.tactic.phy} D{unit.tactic.df} O{unit.tactic.of}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No lines submitted yet.</p>
              )}
            </div>

            {/* Home Lines */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  {data.homeTeam.logoUrl && <img src={data.homeTeam.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{data.homeTeam.name} Lines</h3>
                    <p className="text-[10px] text-slate-400">Active lineup configuration</p>
                  </div>
                </div>
                {isUserHome && (
                  <Link href={`/teams/${data.homeTeam.slug}/lines`} className="text-xs text-blue-400 hover:underline">
                    Edit Lines →
                  </Link>
                )}
              </div>

              {data.lines?.home && data.lines.home.length > 0 ? (
                <div className="space-y-4">
                  {data.lines.home.map((grp, gIdx) => (
                    <div key={gIdx} className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-800/60 pb-1">
                        {grp.title}
                      </p>
                      <div className="space-y-1.5">
                        {grp.units.map((unit) => (
                          <div key={unit.n} className="flex items-center gap-2 text-xs">
                            <span className="w-5 text-[10px] font-bold text-slate-500">{unit.n}.</span>
                            <div className="flex-1 grid grid-cols-3 gap-1">
                              {unit.players.map((p, pIdx) => (
                                <div key={pIdx} className="truncate bg-slate-900 px-2 py-1 rounded text-[11px] text-slate-200 border border-slate-800">
                                  {p ? (p.slug ? <Link href={`/players/${p.slug}`} className="hover:text-blue-400">{cleanName(p.name)}</Link> : cleanName(p.name)) : <span className="text-slate-600">—</span>}
                                </div>
                              ))}
                            </div>
                            {unit.tactic && (
                              <span className="text-[9px] font-mono text-slate-500 shrink-0">
                                P{unit.tactic.phy} D{unit.tactic.df} O{unit.tactic.of}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No lines submitted yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TACTICS & TEAM COMPARISON */}
      {tab === "comparison" && (
        <div className="space-y-6">
          {/* Tactical Dials Comparison */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-200 flex items-center gap-2">
                <span>⚙️</span> Tactical Systems &amp; Playstyle
              </h3>
              <span className="text-xs text-slate-400">Team identity &amp; strategic settings</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Away Tactics */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    {data.awayTeam.logoUrl && <img src={data.awayTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                    <span className="text-xs font-bold text-slate-200">{data.awayTeam.name}</span>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/50">
                    {data.tactics.away.preset ?? "Custom"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">Tempo</span>
                    <span className="font-semibold text-slate-200 capitalize">{data.tactics.away.tempo}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">Forecheck</span>
                    <span className="font-semibold text-slate-200 capitalize">{data.tactics.away.forecheck}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">Puck Style</span>
                    <span className="font-semibold text-slate-200 capitalize">{data.tactics.away.puckStyle}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">D-Zone</span>
                    <span className="font-semibold text-slate-200 capitalize">{data.tactics.away.dZone}</span>
                  </div>
                </div>

                {(data.tactics.away.ppStyle || data.tactics.away.pkStyle) && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block">PP Formation</span>
                      <span className="font-semibold text-amber-400 uppercase">{data.tactics.away.ppStyle ?? "Balanced"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block">PK Structure</span>
                      <span className="font-semibold text-sky-400 uppercase">{data.tactics.away.pkStyle ?? "Balanced"}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Home Tactics */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    {data.homeTeam.logoUrl && <img src={data.homeTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                    <span className="text-xs font-bold text-slate-200">{data.homeTeam.name}</span>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/50">
                    {data.tactics.home.preset ?? "Custom"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">Tempo</span>
                    <span className="font-semibold text-slate-200 capitalize">{data.tactics.home.tempo}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">Forecheck</span>
                    <span className="font-semibold text-slate-200 capitalize">{data.tactics.home.forecheck}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">Puck Style</span>
                    <span className="font-semibold text-slate-200 capitalize">{data.tactics.home.puckStyle}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-bold">D-Zone</span>
                    <span className="font-semibold text-slate-200 capitalize">{data.tactics.home.dZone}</span>
                  </div>
                </div>

                {(data.tactics.home.ppStyle || data.tactics.home.pkStyle) && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block">PP Formation</span>
                      <span className="font-semibold text-amber-400 uppercase">{data.tactics.home.ppStyle ?? "Balanced"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block">PK Structure</span>
                      <span className="font-semibold text-sky-400 uppercase">{data.tactics.home.pkStyle ?? "Balanced"}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
