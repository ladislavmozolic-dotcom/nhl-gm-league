"use client";

import React, { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import {
  saveDailyGamePicksAction,
  saveGameOfTheWeekPickAction,
  evaluateGamePicksAction,
} from "@/app/league/picks/game-actions";

type Player = {
  id: number;
  name: string;
  position: string;
  teamId: number;
  isGoalie: boolean;
  photoUrl: string | null;
};

type Team = {
  id: number;
  name: string;
  slug: string;
  code: string | null;
  logoUrl: string | null;
  gm: string;
  gmNickname: string | null;
};

function SearchablePlayerSelect({
  value,
  players,
  teams,
  placeholder,
  disabled,
  filter,
  onChange,
}: {
  value?: number;
  players: Player[];
  teams: Team[];
  placeholder: string;
  disabled?: boolean;
  filter?: (p: Player) => boolean;
  onChange: (id?: number, playerObj?: Player) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedPlayer = value ? players.find((p) => p.id === value) : null;
  const selectedTeam = selectedPlayer ? teams.find((t) => t.id === selectedPlayer.teamId) : null;

  const teamById = new Map(teams.map((t) => [t.id, t]));

  const filtered = players.filter((p) => {
    if (filter && !filter(p)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    const tm = teamById.get(p.teamId);
    return (
      p.name.toLowerCase().includes(q) ||
      (tm && tm.name.toLowerCase().includes(q)) ||
      (tm && tm.code && tm.code.toLowerCase().includes(q)) ||
      p.position.toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-left transition-all hover:border-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
      >
        {selectedPlayer ? (
          <div className="flex items-center gap-2 truncate">
            {selectedPlayer.photoUrl ? (
              <div className="relative w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-slate-800">
                <Image src={selectedPlayer.photoUrl} alt={selectedPlayer.name} fill className="object-cover" />
              </div>
            ) : (
              <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center text-slate-400 font-mono">
                👤
              </span>
            )}
            <span className="font-semibold text-white truncate">{selectedPlayer.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">
              {selectedPlayer.position}
            </span>
            {selectedTeam && (
              <span className="text-[11px] text-slate-400 truncate">
                ({selectedTeam.code || selectedTeam.name})
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 truncate">{placeholder}</span>
        )}
        <span className="text-slate-500 text-xs flex-shrink-0">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-800 bg-slate-950">
            <input
              type="text"
              autoFocus
              placeholder="🔍 Search player..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/40 p-1">
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800/80 rounded-lg transition-colors"
            >
              -- Not selected --
            </button>

            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No player found
              </div>
            ) : (
              filtered.slice(0, 50).map((p) => {
                const tm = teamById.get(p.teamId);
                const isSelected = p.id === value;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange(p.id, p);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left rounded-lg transition-colors text-xs ${
                      isSelected
                        ? "bg-indigo-600 text-white font-semibold"
                        : "hover:bg-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {p.photoUrl ? (
                        <div className="relative w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-slate-800">
                          <Image src={p.photoUrl} alt={p.name} fill className="object-cover" />
                        </div>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] flex items-center justify-center text-slate-400">
                          👤
                        </span>
                      )}
                      <span className="truncate">{p.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="px-1 py-0.5 rounded bg-slate-800/80 text-[10px] font-mono text-slate-300">
                        {p.position}
                      </span>
                      {tm && (
                        <span className="text-[11px] text-slate-400">
                          {tm.code || tm.name}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GamePicksView({
  data,
  viewerTeam,
  isAdmin,
}: {
  data: any;
  viewerTeam: any;
  isAdmin: boolean;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"picks" | "gotw" | "leaderboard" | "rules">("picks");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const config = data.config || {};
  const teams: Team[] = data.teams || [];
  const players: Player[] = data.players || [];
  const games: any[] = data.games || [];
  const viewerProfile = data.viewerProfile;
  const viewerSubmissions: any[] = data.viewerSubmissions || [];
  const leaderboard: any[] = data.leaderboard || [];
  const currentRival = data.currentRival;

  // Form State for Daily Games (strictly non-GOTW submissions)
  const dailySubMap = new Map(
    viewerSubmissions.filter((s) => !s.isGameOfTheWeek).map((s) => [s.gameId, s])
  );
  const [dailyPicks, setDailyPicks] = useState<Record<number, { winnerTeamId?: number; isJoker?: boolean }>>(() => {
    const init: Record<number, any> = {};
    for (const g of games) {
      const sub = dailySubMap.get(g.id);
      if (sub) {
        init[g.id] = {
          winnerTeamId: sub.winnerTeamId !== null && sub.winnerTeamId !== undefined ? sub.winnerTeamId : undefined,
          isJoker: sub.isJoker || false,
        };
      } else {
        init[g.id] = {
          winnerTeamId: undefined,
          isJoker: false,
        };
      }
    }
    return init;
  });

  // Form State for Game of the Week (strictly GOTW submissions)
  const gotwGame = games.find((g) => g.isGameOfTheWeek);
  const gotwSub = gotwGame
    ? viewerSubmissions.find((s) => s.isGameOfTheWeek && s.gameId === gotwGame.id) || null
    : null;

  const [gotwPick, setGotwPick] = useState({
    winnerTeamId: gotwSub?.winnerTeamId !== null && gotwSub?.winnerTeamId !== undefined ? gotwSub.winnerTeamId : undefined,
    predictedScore: gotwSub?.predictedScore || "4:2",
    firstGoalScorerId: gotwSub?.firstGoalScorerId,
    firstGoalScorerName: gotwSub?.firstGoalScorerName,
    topScorerPlayerId: gotwSub?.topScorerPlayerId,
    topScorerPlayerName: gotwSub?.topScorerPlayerName,
    isJoker: gotwSub?.isJoker || false,
  });

  // Keep gotwPick in sync whenever gotwGame or viewer submissions change
  useEffect(() => {
    if (gotwGame) {
      const sub = viewerSubmissions.find((s) => s.isGameOfTheWeek && s.gameId === gotwGame.id);
      if (sub) {
        setGotwPick({
          winnerTeamId: sub.winnerTeamId !== null && sub.winnerTeamId !== undefined ? sub.winnerTeamId : undefined,
          predictedScore: sub.predictedScore || "4:2",
          firstGoalScorerId: sub.firstGoalScorerId,
          firstGoalScorerName: sub.firstGoalScorerName,
          topScorerPlayerId: sub.topScorerPlayerId,
          topScorerPlayerName: sub.topScorerPlayerName,
          isJoker: sub.isJoker || false,
        });
      }
    }
  }, [gotwGame?.id, viewerSubmissions]);

  const [gameFilter, setGameFilter] = useState<"today" | "all_upcoming" | "results">("today");

  // Filter games based on filter tab
  const scheduledGames = games.filter((g) => g.status === "SCHEDULED");
  const finalGames = games.filter((g) => g.status === "FINAL");

  const todayGames = scheduledGames.filter((g) => g.isFeatured);
  const gamesToDisplay =
    gameFilter === "today"
      ? (todayGames.length > 0 ? todayGames : scheduledGames.slice(0, 8))
      : gameFilter === "all_upcoming"
      ? scheduledGames
      : finalGames;

  const jokersLeft = viewerProfile ? viewerProfile.jokersTotal - viewerProfile.jokersUsed : 5;

  const handleSaveDaily = () => {
    if (!viewerTeam) {
      setMsg({ type: "error", text: "Sign in as a team GM to submit picks." });
      return;
    }

    const unsubmittedPayload = Object.entries(dailyPicks)
      .filter(([gId, p]) => {
        const numId = Number(gId);
        const sub = dailySubMap.get(numId);
        return !sub && p.winnerTeamId !== undefined;
      })
      .map(([gId, p]) => ({
        gameId: Number(gId),
        winnerTeamId: p.winnerTeamId!,
        isJoker: p.isJoker,
      }));

    if (unsubmittedPayload.length === 0) {
      const hasAnyPicks = Object.values(dailyPicks).some((p) => p.winnerTeamId !== undefined);
      if (hasAnyPicks) {
        setMsg({ type: "error", text: "All selected games have already been submitted and are locked." });
      } else {
        setMsg({ type: "error", text: "Select at least one game winner." });
      }
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveDailyGamePicksAction(unsubmittedPayload, config.season, config.league);
        if (res.ok) {
          setMsg({ type: "success", text: "✅ Your daily picks were saved and locked!" });
        } else {
          setMsg({ type: "error", text: res.error || "Error saving picks." });
        }
      } catch (err: any) {
        console.error("Save daily picks error:", err);
        alert("The app was updated to a new version on the server. The page will now reload — please submit your picks again.");
        window.location.reload();
      }
    });
  };

  const handleSaveGotw = () => {
    if (!viewerTeam) {
      setMsg({ type: "error", text: "Sign in as a team GM to submit a pick." });
      return;
    }
    if (!gotwGame || gotwPick.winnerTeamId === undefined) {
      setMsg({ type: "error", text: "Select the winner of the Game of the Week (or a draw)." });
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveGameOfTheWeekPickAction(
          {
            gameId: gotwGame.id,
            winnerTeamId: gotwPick.winnerTeamId!,
            predictedScore: gotwPick.predictedScore,
            firstGoalScorerId: gotwPick.firstGoalScorerId,
            firstGoalScorerName: gotwPick.firstGoalScorerName,
            topScorerPlayerId: gotwPick.topScorerPlayerId,
            topScorerPlayerName: gotwPick.topScorerPlayerName,
            isJoker: gotwPick.isJoker,
          },
          config.season,
          config.league
        );

        if (res.ok) {
          setMsg({ type: "success", text: "✅ Your Game of the Week pick was saved!" });
        } else {
          setMsg({ type: "error", text: res.error || "Error saving the pick." });
        }
      } catch (err: any) {
        console.error("Save GOTW error:", err);
        alert("The app was updated to a new version on the server. The page will now reload — please submit your pick again.");
        window.location.reload();
      }
    });
  };

  const handleEvaluate = () => {
    startTransition(async () => {
      try {
        const res = await evaluateGamePicksAction(config.season, config.league);
        if (res.ok && "message" in res) {
          setMsg({ type: "success", text: `⚡ ${res.message}` });
        } else {
          setMsg({ type: "error", text: (res as any).error || "Error during evaluation." });
        }
      } catch (err: any) {
        console.error("Evaluate error:", err);
        alert("The app was updated on the server. The page will now reload.");
        window.location.reload();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* GM PROFILE STATS BAR */}
      {viewerProfile && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-2xl">
                🏒
              </div>
              <div>
                <div className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">My Predictor Profile</div>
                <div className="text-lg font-black text-white flex items-center gap-2">
                  <span>{viewerTeam.gmNickname || viewerTeam.gm || viewerTeam.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                    {viewerProfile.totalPoints} pts
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Streak Badge */}
              <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
                <span className="text-base">🔥</span>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Streak</div>
                  <div className="font-bold text-amber-400">
                    {viewerProfile.currentStreak} v rade{" "}
                    <span className="text-[10px] text-slate-400 font-normal">(Rekord: {viewerProfile.bestStreak})</span>
                  </div>
                </div>
              </div>

              {/* Jokers Left */}
              <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
                <span className="text-base">🃏</span>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Jokeri (×3)</div>
                  <div className="font-bold text-indigo-300 font-mono">
                    {jokersLeft} / {viewerProfile.jokersTotal} available
                  </div>
                </div>
              </div>

              {/* Rival Matchup */}
              {currentRival && (
                <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-rose-500/30 flex items-center gap-2">
                  <span className="text-base">⚔️</span>
                  <div>
                    <div className="text-[10px] text-rose-300 font-medium">Rival of the Week #{currentRival.week}</div>
                    <div className="font-bold text-white truncate max-w-[120px]">
                      vs {currentRival.rivalTeam?.name || "Opponent"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TABS NAVIGATION */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveSubTab("picks")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "picks"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span>🎯 Games of the Day (2 pts)</span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-950/80 text-[10px] text-indigo-300 font-mono">
              {todayGames.length > 0 ? todayGames.length : scheduledGames.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab("gotw")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "gotw"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                : "bg-slate-800/80 text-amber-300 hover:bg-slate-800 border border-amber-500/20"
            }`}
          >
            <span>🌟 Game of the Week</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-950/80 text-[10px] text-amber-300 font-mono">
              {gotwGame ? "15 pts" : "Awaiting selection"}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab("leaderboard")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "leaderboard"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span>🏆 Game Picks Leaderboard</span>
          </button>

          <button
            onClick={() => setActiveSubTab("rules")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "rules"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-slate-800/80 text-slate-400 hover:bg-slate-800"
            }`}
          >
            <span>📖 Rules & Scoring</span>
          </button>
        </div>

        {isAdmin && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleEvaluate}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-600/20 disabled:opacity-50"
          >
            <span>⚡ Run Game Evaluation</span>
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            msg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="underline hover:opacity-80">
            Close
          </button>
        </div>
      )}

      {/* SUBTAB 1: DAILY PICKS */}
      {activeSubTab === "picks" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🎯 UNHL Game of the Day / Game Picks</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Predict the result after regulation (60 min): <strong>1 (Home win)</strong>, <strong>X (Draw / overtime)</strong>, <strong>2 (Away win)</strong>. A correct pick = <strong>2 points</strong> (or <strong>6 pts with a ×3 Joker</strong>).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveDaily}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex-shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>💾 Save Daily Picks</span>
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setGameFilter("today")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                gameFilter === "today"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <span>🔥 Today's games</span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-[10px] text-indigo-300 font-mono">
                {todayGames.length > 0 ? todayGames.length : scheduledGames.slice(0, 8).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setGameFilter("all_upcoming")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                gameFilter === "all_upcoming"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <span>📅 All upcoming games</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                {scheduledGames.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setGameFilter("results")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                gameFilter === "results"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <span>📜 Recent results</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                {finalGames.length}
              </span>
            </button>
          </div>

          {gamesToDisplay.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
              <div className="text-3xl">📅</div>
              <div className="text-sm font-bold text-white">No games in this category</div>
              <div className="text-xs text-slate-400 max-w-md mx-auto">
                Check the other filters or watch the game calendar before the next round starts.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gamesToDisplay.map((g) => {
                const current = dailyPicks[g.id] || {};
                const sub = dailySubMap.get(g.id);
                const isLocked = g.isLocked || Boolean(sub);

                return (
                  <div
                    key={g.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 relative ${
                      sub?.isEvaluated
                        ? sub.pointsAwarded > 0
                          ? "bg-emerald-950/20 border-emerald-500/40"
                          : "bg-rose-950/20 border-rose-500/30"
                        : current.winnerTeamId !== undefined
                        ? "bg-slate-900 border-indigo-500/40 shadow-lg shadow-indigo-950/30"
                        : "bg-slate-950/70 border-slate-800"
                    }`}
                  >
                    {/* Header: Date & Badges */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono">
                        {g.gameDate
                          ? new Date(g.gameDate).toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })
                          : `Deň #${g.round || 1}`}
                      </span>

                      <div className="flex items-center gap-1">
                        {g.isLocked ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                            {g.status === "FINAL" ? `FINAL ${g.homeGoals}:${g.awayGoals}` : "🔒 Locked"}
                          </span>
                        ) : sub ? (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px] border border-indigo-500/30">
                            🔒 Picked
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                            🟢 Open
                          </span>
                        )}
                        {sub?.isEvaluated && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              sub.pointsAwarded > 0
                                ? "bg-emerald-500 text-slate-950"
                                : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            +{sub.pointsAwarded} b
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Matchup Team Selection Buttons (1 vs X vs 2) */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {/* Away Team (2) */}
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setDailyPicks({
                            ...dailyPicks,
                            [g.id]: { ...current, winnerTeamId: g.awayTeamId },
                          })
                        }
                        className={`p-2 sm:p-2.5 rounded-xl border text-center sm:text-left transition-all relative ${
                          current.winnerTeamId === g.awayTeamId
                            ? "bg-indigo-600 border-indigo-400 text-white font-bold shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400 opacity-100"
                            : "bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70 disabled:opacity-40"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2">
                          {g.awayTeam?.logoUrl && (
                            <div className="relative w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0">
                              <Image src={g.awayTeam.logoUrl} alt={g.awayTeam.name} fill className="object-contain" />
                            </div>
                          )}
                          <div className="truncate text-center sm:text-left">
                            <div className="text-xs truncate font-bold">{g.awayTeam?.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">2 (Hostia)</div>
                          </div>
                        </div>
                      </button>

                      {/* Draw / Remíza (X) */}
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setDailyPicks({
                            ...dailyPicks,
                            [g.id]: { ...current, winnerTeamId: 0 },
                          })
                        }
                        className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center relative ${
                          current.winnerTeamId === 0
                            ? "bg-amber-600 border-amber-400 text-white font-bold shadow-md shadow-amber-600/30 ring-2 ring-amber-400 opacity-100"
                            : "bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70 disabled:opacity-40"
                        }`}
                      >
                        <span className="text-sm sm:text-base font-black tracking-wider text-white">X</span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">Draw (60 min)</span>
                      </button>

                      {/* Home Team (1) */}
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setDailyPicks({
                            ...dailyPicks,
                            [g.id]: { ...current, winnerTeamId: g.homeTeamId },
                          })
                        }
                        className={`p-2 sm:p-2.5 rounded-xl border text-center sm:text-left transition-all relative ${
                          current.winnerTeamId === g.homeTeamId
                            ? "bg-indigo-600 border-indigo-400 text-white font-bold shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400 opacity-100"
                            : "bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70 disabled:opacity-40"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2">
                          {g.homeTeam?.logoUrl && (
                            <div className="relative w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0">
                              <Image src={g.homeTeam.logoUrl} alt={g.homeTeam.name} fill className="object-contain" />
                            </div>
                          )}
                          <div className="truncate text-center sm:text-left">
                            <div className="text-xs truncate font-bold">{g.homeTeam?.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">1 (Doma)</div>
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Modifiers: Joker */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-[11px] text-slate-400">Win: <strong className="text-indigo-300">2 pts</strong></span>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          disabled={isLocked || (jokersLeft <= 0 && !current.isJoker)}
                          checked={current.isJoker || false}
                          onChange={(e) =>
                            setDailyPicks({
                              ...dailyPicks,
                              [g.id]: { ...current, isJoker: e.target.checked },
                            })
                          }
                          className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                        />
                        <span className={current.isJoker ? "font-bold text-amber-400" : ""}>
                          🃏 Joker (×3 = 6 pts)
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: GAME OF THE WEEK */}
      {activeSubTab === "gotw" && (
        gotwGame ? (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
                <div>
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                    <span>🌟 UNHL Game of the Week</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                      Max 15 points
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30">
                      🤖 AI Pick of the Week
                    </span>
                    {gotwSub && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] border border-emerald-500/30 font-bold">
                        🔒 Picked & Locked
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                    {gotwGame.awayTeam?.name} vs {gotwGame.homeTeam?.name}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    The special game of the week. Predict the winner (1/X/2), the exact score, the first goal scorer and the top-scoring player.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={isPending || gotwGame.isLocked || Boolean(gotwSub)}
                    onClick={handleSaveGotw}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex-shrink-0 flex items-center justify-center gap-2 ${
                      gotwSub
                        ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                        : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 disabled:opacity-50"
                    }`}
                  >
                    <span>{gotwSub ? "🔒 Pick submitted (Locked)" : "💾 Save Game of the Week Pick"}</span>
                  </button>
                </div>
              </div>

              {/* Matchup Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pick Winner */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    1. Result after 60 min. (2 points: 1 - X - 2)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={gotwGame.isLocked || Boolean(gotwSub)}
                      onClick={() => setGotwPick({ ...gotwPick, winnerTeamId: gotwGame.awayTeamId })}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        gotwPick.winnerTeamId === gotwGame.awayTeamId
                          ? "bg-amber-600 border-amber-400 text-white font-bold shadow-lg ring-2 ring-amber-400 opacity-100"
                          : "bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                      }`}
                    >
                      <div className="text-sm font-bold truncate">{gotwGame.awayTeam?.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">2 (Hostia)</div>
                    </button>

                    <button
                      type="button"
                      disabled={gotwGame.isLocked || Boolean(gotwSub)}
                      onClick={() => setGotwPick({ ...gotwPick, winnerTeamId: 0 })}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                        gotwPick.winnerTeamId === 0
                          ? "bg-amber-600 border-amber-400 text-white font-bold shadow-lg ring-2 ring-amber-400 opacity-100"
                          : "bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                      }`}
                    >
                      <div className="text-sm font-black text-white">X</div>
                      <div className="text-[10px] text-slate-400 font-mono">Draw (OT/SO)</div>
                    </button>

                    <button
                      type="button"
                      disabled={gotwGame.isLocked || Boolean(gotwSub)}
                      onClick={() => setGotwPick({ ...gotwPick, winnerTeamId: gotwGame.homeTeamId })}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        gotwPick.winnerTeamId === gotwGame.homeTeamId
                          ? "bg-amber-600 border-amber-400 text-white font-bold shadow-lg ring-2 ring-amber-400 opacity-100"
                          : "bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                      }`}
                    >
                      <div className="text-sm font-bold truncate">{gotwGame.homeTeam?.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">1 (Doma)</div>
                    </button>
                  </div>
                </div>

                {/* Exact Score */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    2. Exact score (5 points)
                  </label>
                  <input
                    type="text"
                    disabled={gotwGame.isLocked || Boolean(gotwSub)}
                    placeholder="e.g. 5:3 or 4:2"
                    value={gotwPick.predictedScore}
                    onChange={(e) => setGotwPick({ ...gotwPick, predictedScore: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!gotwSub) handleSaveGotw();
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-slate-950/90 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* First Goal Scorer */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    3. First goal scorer (5 points)
                  </label>
                  <SearchablePlayerSelect
                    disabled={gotwGame.isLocked || Boolean(gotwSub)}
                    value={gotwPick.firstGoalScorerId}
                    players={players}
                    teams={teams}
                    placeholder="-- Select the first goal scorer --"
                    filter={(p) =>
                      !p.isGoalie &&
                      (p.teamId === gotwGame.homeTeamId || p.teamId === gotwGame.awayTeamId)
                    }
                    onChange={(pid, pObj) =>
                      setGotwPick({
                        ...gotwPick,
                        firstGoalScorerId: pid,
                        firstGoalScorerName: pObj?.name,
                      })
                    }
                  />
                </div>

                {/* Top Scorer */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    4. Player with the most points in the game (3 points)
                  </label>
                  <SearchablePlayerSelect
                    disabled={gotwGame.isLocked || Boolean(gotwSub)}
                    value={gotwPick.topScorerPlayerId}
                    players={players}
                    teams={teams}
                    placeholder="-- Select the player with the most points --"
                    filter={(p) =>
                      !p.isGoalie &&
                      (p.teamId === gotwGame.homeTeamId || p.teamId === gotwGame.awayTeamId)
                    }
                    onChange={(pid, pObj) =>
                      setGotwPick({
                        ...gotwPick,
                        topScorerPlayerId: pid,
                        topScorerPlayerName: pObj?.name,
                      })
                    }
                  />
                </div>
              </div>

              {/* Joker Modifer on GOTW */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input
                    type="checkbox"
                    disabled={gotwGame.isLocked || Boolean(gotwSub) || (jokersLeft <= 0 && !gotwPick.isJoker)}
                    checked={gotwPick.isJoker || false}
                    onChange={(e) => setGotwPick({ ...gotwPick, isJoker: e.target.checked })}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900 disabled:cursor-not-allowed"
                  />
                  <span className="font-bold text-amber-300">
                    🃏 Use the Joker on the Game of the Week (Points ×3 = up to 45 points!)
                  </span>
                </label>

                <span className="text-[11px] text-slate-400 font-mono">
                  You have {jokersLeft} Jokers left
                </span>
              </div>

              {/* Bottom Save Action Bar */}
              <div className="pt-4 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-950/20 p-4 rounded-xl">
                <div className="text-xs text-slate-300">
                  {gotwSub ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      ✅ Your Game of the Week pick has been saved and locked.
                    </span>
                  ) : (
                    <span>Predict the result, the score and the players. After you click the button your pick is submitted and locked.</span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isPending || gotwGame.isLocked || Boolean(gotwSub)}
                  onClick={handleSaveGotw}
                  className={`w-full sm:w-auto px-7 py-3 rounded-xl text-xs font-black transition-all shadow-xl flex items-center justify-center gap-2 ${
                    gotwSub
                      ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                      : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-600/40 cursor-pointer active:scale-95"
                  }`}
                >
                  <span>{gotwSub ? "🔒 Pick submitted (Locked)" : "💾 Save Game of the Week Pick"}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
            <div className="text-4xl">🤖</div>
            <h3 className="text-base font-bold text-white">Game of the Week</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              The AI automatically analyses the schedule and prepares the most attractive matchup of the week.
            </p>
          </div>
        )
      )}

      {/* SUBTAB 3: LEADERBOARD & MONTHLY */}
      {activeSubTab === "leaderboard" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white">🏆 Game Picks Leaderboard (Season & Monthly)</h2>
              <p className="text-xs text-slate-400">Overview of points, streaks and winners for each month.</p>
            </div>

            <div className="flex items-center gap-1 text-xs">
              {["all", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"].map((mKey) => (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => setSelectedMonth(mKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedMonth === mKey
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {mKey === "all"
                    ? "Celkovo"
                    : mKey === "2026-10"
                    ? "Okt"
                    : mKey === "2026-11"
                    ? "Nov"
                    : mKey === "2026-12"
                    ? "Dec"
                    : mKey === "2027-01"
                    ? "Jan"
                    : mKey === "2027-02"
                    ? "Feb"
                    : mKey === "2027-03"
                    ? "Mar"
                    : "Apr"}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">General Manager / Team</th>
                  <th className="py-3 px-4 text-center">🔥 Streak</th>
                  <th className="py-3 px-4 text-center">⚡ Record</th>
                  <th className="py-3 px-4 text-center">🃏 Jokers</th>
                  <th className="py-3 px-4 text-right font-bold text-white">Points ({selectedMonth === "all" ? "Total" : selectedMonth})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No entries in the picks leaderboard yet.
                    </td>
                  </tr>
                ) : (
                  leaderboard
                    .slice()
                    .sort((a, b) => {
                      if (selectedMonth === "all") {
                        return b.totalPoints - a.totalPoints;
                      }
                      const mPtsA = (a.monthlyPoints as Record<string, number>)?.[selectedMonth] || 0;
                      const mPtsB = (b.monthlyPoints as Record<string, number>)?.[selectedMonth] || 0;
                      return mPtsB - mPtsA;
                    })
                    .map((prof, idx) => {
                      const isMe = viewerTeam && prof.teamId === viewerTeam.id;
                      const displayPts =
                        selectedMonth === "all"
                          ? prof.totalPoints
                          : (prof.monthlyPoints as Record<string, number>)?.[selectedMonth] || 0;

                      return (
                        <tr
                          key={prof.id}
                          className={`transition-colors ${
                            isMe ? "bg-indigo-600/10 font-bold" : "hover:bg-slate-900/40"
                          }`}
                        >
                          <td className="py-3 px-4 text-center font-mono text-slate-400">
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {prof.team?.logoUrl && (
                                <div className="relative w-6 h-6 flex-shrink-0">
                                  <Image src={prof.team.logoUrl} alt={prof.team.name} fill className="object-contain" />
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-white">
                                  {prof.team?.gmNickname || prof.team?.gm || prof.team?.name}
                                </div>
                                <div className="text-[10px] text-slate-400">{prof.team?.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {prof.currentStreak > 0 ? (
                              <span className="text-amber-400 font-bold">🔥 {prof.currentStreak}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-400">
                            {prof.bestStreak}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-400">
                            {prof.jokersTotal - prof.jokersUsed}/{prof.jokersTotal}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-sm text-indigo-300">
                            {displayPts} b
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: RULES */}
      {activeSubTab === "rules" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
              <span>🎯 Games of the Day (2 points)</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Every game day the system automatically selects the games of the day based on the real NHL schedule.
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li>You predict the result after 60 minutes: <strong className="text-white">1 (Home)</strong>, <strong className="text-white">X (Draw / overtime)</strong>, <strong className="text-white">2 (Away)</strong>.</li>
              <li>You earn <strong className="text-white">2 points</strong> for every correct pick.</li>
              <li>When you play a Joker, a correct pick earns up to <strong className="text-amber-400">6 points (×3)</strong>.</li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <span>🌟 Game of the Week (Max 15 pts)</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              One selected headline game of the week with detailed picks:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li>Game result after 60 min. (1 - X - 2): <strong className="text-white">2 points</strong></li>
              <li>Exact score: <strong className="text-white">5 points</strong></li>
              <li>First goal scorer: <strong className="text-white">5 points</strong></li>
              <li>Most points in the game: <strong className="text-white">3 points</strong></li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <span>🃏 Jokers (×3)</span>
            </h3>
            <ul className="list-disc list-inside text-slate-400 space-y-1.5">
              <li>
                <strong className="text-white">5× Joker for the whole season:</strong> You can use it on any game. It multiplies all points earned from that game by <strong className="text-amber-400">×3</strong> (for a regular game you earn up to 6 pts instead of 2, for the Game of the Week up to 45 pts)!
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <span>⚡ Streaks, 📅 Weekly & Monthly Rewards</span>
            </h3>
            <ul className="list-disc list-inside text-slate-400 space-y-1.5 text-xs">
              <li>3 correct picks in a row = <strong className="text-white">+2 bonus points</strong></li>
              <li>5 correct picks in a row = <strong className="text-white">+5 bonus points</strong></li>
              <li>10 correct picks in a row = <strong className="text-white">+15 bonus points</strong></li>
              <li>
                <strong className="text-white">Winner of the Week:</strong> The best predictor of the week earns <strong className="text-emerald-400">+$200,000</strong> for the club bank account.
              </li>
              <li>
                <strong className="text-white">Monthly Champion:</strong> The winner of the month gets a 🎟️ <strong className="text-amber-300">Round 8 Draft Pick</strong> (or Round 9), <strong className="text-amber-300">+10 points</strong> and a 🥇 badge on the profile.
              </li>
            </ul>
          </div>

          {/* REWARDS SECTION */}
          <div className="md:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-indigo-950/40 border border-amber-500/30 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 border-b border-amber-500/20 pb-3">
              <span className="text-2xl">🎁</span>
              <div>
                <h3 className="text-base font-bold text-white">Official Rewards for Picks Winners (Prizes, Draft Picks & Finances)</h3>
                <p className="text-xs text-slate-400">
                  At the end of the season, after Game Picks and Season Picks are tallied, the top three predictors are awarded club finances and draft picks:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1st Place */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">🥇 1. Miesto</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">Champion</span>
                </div>
                <div className="text-lg font-black text-amber-300">+$3,000,000</div>
                <ul className="text-slate-300 space-y-1 text-[11px]">
                  <li>🎟️ <strong>Round 8 Draft Pick</strong> (or Round 9)</li>
                  <li>🥇 Gold badge <strong>Season Predictor Champion</strong></li>
                </ul>
              </div>

              {/* 2nd Place */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">🥈 2. Miesto</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 font-bold">Vicemajster</span>
                </div>
                <div className="text-lg font-black text-slate-200">+$1,500,000</div>
                <ul className="text-slate-300 space-y-1 text-[11px]">
                  <li>🎟️ <strong>Round 8 Draft Pick</strong> (or Round 9)</li>
                  <li>🥈 Silver badge <strong>Vice-Champion</strong></li>
                </ul>
              </div>

              {/* 3rd Place */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-700/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">🥉 3. Miesto</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-700/20 text-amber-400 font-bold">3. Miesto</span>
                </div>
                <div className="text-lg font-black text-amber-400">+$750,000</div>
                <ul className="text-slate-300 space-y-1 text-[11px]">
                  <li>🎟️ <strong>Round 8 Draft Pick</strong> (or Round 9)</li>
                  <li>🥉 Bronze badge <strong>3rd Place</strong></li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                <strong className="text-emerald-400">📅 Weekly Game Picks:</strong> Every winner of a game week in Game Picks earns <strong>+$200,000</strong> for the club bank account.
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                <strong className="text-amber-300">🏆 Monthly Champion:</strong> Every winner of the month gets a 🎟️ <strong>Round 8 Draft Pick</strong> (or Round 9), <strong>+10 points</strong> and a badge.
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              ℹ️ <strong>Draft Pick rule:</strong> All bonus draft picks (the season TOP 3 and the monthly champions) are generated in <strong>Round 8</strong> of the rookie draft. If all 32 positions in Round 8 are already taken, the pick is automatically recorded in <strong>Round 9</strong>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
