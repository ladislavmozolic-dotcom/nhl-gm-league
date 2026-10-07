"use client";

import React, { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import {
  saveDailyGamePicksAction,
  saveGameOfTheWeekPickAction,
  evaluateGamePicksAction,
} from "@/app/league/picks/game-actions";
import { useLang } from "@/components/LangProvider";

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
  const lang = useLang();
  const isEn = lang === "en";

  const [activeSubTab, setActiveSubTab] = useState<"picks" | "my_picks" | "gotw" | "leaderboard" | "rules">("picks");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "won" | "lost" | "pending">("all");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"all" | "daily" | "gotw">("all");
  const [historySortOrder, setHistorySortOrder] = useState<"desc" | "asc">("desc");
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

  const gamesMap = new Map<number, any>(games.map((g) => [g.id, g]));

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

  const [gameFilter, setGameFilter] = useState<"today" | "all_upcoming" | "my_picks" | "results">("today");

  // Filter games based on filter tab
  const scheduledGames = games.filter((g) => g.status === "SCHEDULED");
  const finalGames = games.filter((g) => g.status === "FINAL");
  const todayGames = scheduledGames.filter((g) => g.isFeatured);
  const myPicksGames = games.filter((g) => dailySubMap.has(g.id) || (gotwSub && gotwSub.gameId === g.id));

  const gamesToDisplay =
    gameFilter === "today"
      ? (todayGames.length > 0 ? todayGames : scheduledGames.slice(0, 8))
      : gameFilter === "all_upcoming"
      ? scheduledGames
      : gameFilter === "my_picks"
      ? myPicksGames
      : finalGames;

  const jokersLeft = viewerProfile ? viewerProfile.jokersTotal - viewerProfile.jokersUsed : 5;

  // Overview stats for viewer submissions
  const totalMyPicks = viewerSubmissions.length;
  const evaluatedMyPicks = viewerSubmissions.filter((s) => s.isEvaluated);
  const wonMyPicks = evaluatedMyPicks.filter((s) => s.pointsAwarded > 0);
  const lostMyPicks = evaluatedMyPicks.filter((s) => s.pointsAwarded === 0);
  const pendingMyPicks = viewerSubmissions.filter((s) => !s.isEvaluated);
  const totalPointsWon = viewerSubmissions.reduce((acc, s) => acc + (s.pointsAwarded || 0), 0);
  const winRatePct = evaluatedMyPicks.length > 0 ? Math.round((wonMyPicks.length / evaluatedMyPicks.length) * 100) : 0;

  // Filtered and sorted history items
  const filteredHistory = viewerSubmissions
    .filter((s) => {
      if (historyTypeFilter === "daily" && s.isGameOfTheWeek) return false;
      if (historyTypeFilter === "gotw" && !s.isGameOfTheWeek) return false;
      if (historyStatusFilter === "won") return s.isEvaluated && s.pointsAwarded > 0;
      if (historyStatusFilter === "lost") return s.isEvaluated && s.pointsAwarded === 0;
      if (historyStatusFilter === "pending") return !s.isEvaluated;
      return true;
    })
    .sort((a, b) => {
      const gA = gamesMap.get(a.gameId);
      const gB = gamesMap.get(b.gameId);
      const tA = gA?.gameDate ? new Date(gA.gameDate).getTime() : new Date(a.createdAt).getTime();
      const tB = gB?.gameDate ? new Date(gB.gameDate).getTime() : new Date(b.createdAt).getTime();
      return historySortOrder === "desc" ? tB - tA : tA - tB;
    });

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
      {/* GM PROFILE STATS BAR */}
      {viewerProfile && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-2xl">
                🏒
              </div>
              <div>
                <div className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                  {isEn ? "My Predictor Profile" : "Môj tipérsky profil"}
                </div>
                <div className="text-lg font-black text-white flex items-center gap-2">
                  <span>{viewerTeam.gmNickname || viewerTeam.gm || viewerTeam.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                    {viewerProfile.totalPoints} {isEn ? "pts" : "b"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Streak Badge */}
              <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
                <span className="text-base">🔥</span>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">{isEn ? "Streak" : "Séria"}</div>
                  <div className="font-bold text-amber-400">
                    {viewerProfile.currentStreak} {isEn ? "in a row" : "v rade"}{" "}
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({isEn ? "Best" : "Rekord"}: {viewerProfile.bestStreak})
                    </span>
                  </div>
                </div>
              </div>

              {/* Jokers Left */}
              <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
                <span className="text-base">🃏</span>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">{isEn ? "Jokers (×3)" : "Žolíky (×3)"}</div>
                  <div className="font-bold text-indigo-300 font-mono">
                    {jokersLeft} / {viewerProfile.jokersTotal} {isEn ? "available" : "k dispozícii"}
                  </div>
                </div>
              </div>

              {/* Rival Matchup */}
              {currentRival && (
                <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-rose-500/30 flex items-center gap-2">
                  <span className="text-base">⚔️</span>
                  <div>
                    <div className="text-[10px] text-rose-300 font-medium">
                      {isEn ? "Rival of the Week" : "Rival týždňa"} #{currentRival.week}
                    </div>
                    <div className="font-bold text-white truncate max-w-[120px]">
                      vs {currentRival.rivalTeam?.name || (isEn ? "Opponent" : "Súper")}
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
            <span>🎯 {isEn ? "Games of the Day (2 pts)" : "Denné zápasy (2 b)"}</span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-950/80 text-[10px] text-indigo-300 font-mono">
              {todayGames.length > 0 ? todayGames.length : scheduledGames.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab("my_picks")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "my_picks"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span>📜 {isEn ? "My Picks & Results" : "Moje tipy a história"}</span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-950/80 text-[10px] text-indigo-300 font-mono">
              {viewerSubmissions.length}
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
            <span>🌟 {isEn ? "Game of the Week" : "Zápas týždňa"}</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-950/80 text-[10px] text-amber-300 font-mono">
              {gotwGame ? "15 pts" : (isEn ? "Awaiting selection" : "Čaká na výber")}
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
            <span>🏆 {isEn ? "Leaderboard" : "Tabuľka tipérov"}</span>
          </button>

          <button
            onClick={() => setActiveSubTab("rules")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "rules"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-slate-800/80 text-slate-400 hover:bg-slate-800"
            }`}
          >
            <span>📖 {isEn ? "Rules & Scoring" : "Pravidlá a odmeny"}</span>
          </button>
        </div>

        {isAdmin && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleEvaluate}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-600/20 disabled:opacity-50"
          >
            <span>⚡ {isEn ? "Run Game Evaluation" : "Spustiť vyhodnotenie"}</span>
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
                <span>🎯 {isEn ? "UNHL Game of the Day / Game Picks" : "UNHL Denné tipy zápasov"}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEn ? (
                  <>Predict the result after regulation (60 min): <strong>1 (Home win)</strong>, <strong>X (Draw / overtime)</strong>, <strong>2 (Away win)</strong>. A correct pick = <strong>2 points</strong> (or <strong>6 pts with a ×3 Joker</strong>).</>
                ) : (
                  <>Tipujte výsledok po 60 minútach: <strong>1 (Výhra domáci)</strong>, <strong>X (Remíza / predĺženie)</strong>, <strong>2 (Výhra hostia)</strong>. Správny tip = <strong>2 body</strong> (alebo <strong>6 b so žolíkom ×3</strong>).</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveDaily}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex-shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>💾 {isEn ? "Save Daily Picks" : "Uložiť denné tipy"}</span>
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setGameFilter("today")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                gameFilter === "today"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <span>🔥 {isEn ? "Today's games" : "Dnešné zápasy"}</span>
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
              <span>📅 {isEn ? "All upcoming games" : "Všetky nadchádzajúce"}</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                {scheduledGames.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setGameFilter("my_picks")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                gameFilter === "my_picks"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <span>🎯 {isEn ? "My picks" : "Moje tipy"}</span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-[10px] text-indigo-300 font-mono">
                {dailySubMap.size}
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
              <span>📜 {isEn ? "Recent results" : "Výsledky zápasov"}</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                {finalGames.length}
              </span>
            </button>
          </div>

          {gameFilter === "my_picks" && (
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-indigo-200">
                {isEn
                  ? "Showing the games where you submitted picks. To view your full predictions history and outcomes, switch to My Picks & Results."
                  : "Zobrazujú sa zápasy, kde máte odoslaný tip. Pre detailné vyhodnotenie a históriu výsledkov prejdite na Moje tipy a história."}
              </span>
              <button
                type="button"
                onClick={() => setActiveSubTab("my_picks")}
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-md shadow-indigo-600/30"
              >
                <span>{isEn ? "View My Picks & Results →" : "Zobraziť Moje tipy a história →"}</span>
              </button>
            </div>
          )}

          {gamesToDisplay.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
              <div className="text-3xl">📅</div>
              <div className="text-sm font-bold text-white">
                {isEn ? "No games in this category" : "Žiadne zápasy v tejto kategórii"}
              </div>
              <div className="text-xs text-slate-400 max-w-md mx-auto">
                {isEn
                  ? "Check the other filters or watch the game calendar before the next round starts."
                  : "Skontrolujte ostatné filtre alebo sledujte kalendár pred začiatkom ďalšieho kola."}
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
                          ? new Date(g.gameDate).toLocaleDateString(isEn ? "en-GB" : "sk-SK", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })
                          : `${isEn ? "Day" : "Deň"} #${g.round || 1}`}
                      </span>

                      <div className="flex items-center gap-1">
                        {g.isLocked ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                            {g.status === "FINAL" ? `FINAL ${g.homeGoals}:${g.awayGoals}` : (isEn ? "🔒 Locked" : "🔒 Zamknuté")}
                          </span>
                        ) : sub ? (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px] border border-indigo-500/30">
                            {isEn ? "🔒 Picked" : "🔒 Natipované"}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                            {isEn ? "🟢 Open" : "🟢 Otvorené"}
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
                            +{sub.pointsAwarded} {isEn ? "pts" : "b"}
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
                            <div className="text-[10px] text-slate-400 font-mono">2 ({isEn ? "Away" : "Hostia"})</div>
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
                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">
                          {isEn ? "Draw (60 min)" : "Remíza (60 min)"}
                        </span>
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
                            <div className="text-[10px] text-slate-400 font-mono">1 ({isEn ? "Home" : "Domáci"})</div>
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Modifiers: Joker */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-[11px] text-slate-400">
                        {isEn ? "Win" : "Výhra"}: <strong className="text-indigo-300">2 {isEn ? "pts" : "b"}</strong>
                      </span>
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
                          🃏 {isEn ? "Joker (×3 = 6 pts)" : "Žolík (×3 = 6 b)"}
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

      {/* SUBTAB: MY PICKS & RESULTS */}
      {activeSubTab === "my_picks" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>📜 {isEn ? "My Picks History & Results" : "História mojich tipov a výsledky"}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                {isEn
                  ? "Detailed log of all your submitted match predictions, final game outcomes, accuracy and earned points."
                  : "Detailný prehľad všetkých vašich odoslaných tipov na denné zápasy aj Zápasy týždňa, konečných výsledkov a získaných bodov."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveSubTab("picks")}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex-shrink-0 flex items-center justify-center gap-1.5"
            >
              <span>🎯 {isEn ? "Make New Daily Picks" : "Podať nové denné tipy"}</span>
            </button>
          </div>

          {!viewerTeam ? (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
              <div className="text-4xl">🔒</div>
              <h3 className="text-base font-bold text-white">
                {isEn ? "Sign in to view your predictions" : "Pre zobrazenie tipov sa prihláste"}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {isEn
                  ? "Sign in as a team GM in the top navigation to track your predictions, streaks and points."
                  : "Prihláste sa ako manažér tímu v hornej lište pre sledovanie vašich tipov, sérií a bodov."}
              </p>
            </div>
          ) : (
            <>
              {/* PERFORMANCE SUMMARY STATS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <span>🎯</span>
                    <span>{isEn ? "Total Picks" : "Celkovo tipov"}</span>
                  </div>
                  <div className="text-xl font-black text-white font-mono">{totalMyPicks}</div>
                  <div className="text-[10px] text-slate-500">
                    {evaluatedMyPicks.length} {isEn ? "evaluated" : "vyhodnotených"}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <span>🏆</span>
                    <span>{isEn ? "Success Rate" : "Úspešnosť tipov"}</span>
                  </div>
                  <div className="text-xl font-black text-emerald-400 font-mono">{winRatePct}%</div>
                  <div className="text-[10px] text-slate-500">
                    {wonMyPicks.length} {isEn ? "of" : "z"} {evaluatedMyPicks.length} {isEn ? "correct" : "správnych"}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 to-slate-900 space-y-1">
                  <div className="text-[11px] text-indigo-300 font-medium flex items-center gap-1">
                    <span>⭐</span>
                    <span>{isEn ? "Points Won" : "Získané body"}</span>
                  </div>
                  <div className="text-xl font-black text-indigo-300 font-mono">+{totalPointsWon} {isEn ? "pts" : "b"}</div>
                  <div className="text-[10px] text-indigo-400/80 font-mono">
                    {viewerProfile ? `${viewerProfile.totalPoints} ${isEn ? "total profile pts" : "celkovo v profile"}` : ""}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <span>🔥</span>
                    <span>{isEn ? "Current Streak" : "Aktuálna séria"}</span>
                  </div>
                  <div className="text-xl font-black text-amber-400 font-mono">
                    {viewerProfile?.currentStreak || 0}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isEn ? "Record" : "Rekord"}: {viewerProfile?.bestStreak || 0}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <span>🃏</span>
                    <span>{isEn ? "Jokers Left" : "Zostávajúce žolíky"}</span>
                  </div>
                  <div className="text-xl font-black text-indigo-300 font-mono">
                    {jokersLeft} / {viewerProfile?.jokersTotal || 5}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {viewerProfile?.jokersUsed || 0} {isEn ? "used so far" : "použitých"}
                  </div>
                </div>
              </div>

              {/* FILTER & SORT TOOLBAR */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Status Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-400 font-semibold mr-1">{isEn ? "Status:" : "Stav:"}</span>
                    <button
                      type="button"
                      onClick={() => setHistoryStatusFilter("all")}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                        historyStatusFilter === "all"
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {isEn ? "All" : "Všetky"} ({totalMyPicks})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryStatusFilter("won")}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                        historyStatusFilter === "won"
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                          : "bg-slate-800 text-emerald-400 hover:text-white"
                      }`}
                    >
                      <span>✅</span>
                      <span>{isEn ? "Won" : "Správne"}</span>
                      <span className="font-mono text-[10px]">({wonMyPicks.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryStatusFilter("lost")}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                        historyStatusFilter === "lost"
                          ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                          : "bg-slate-800 text-rose-400 hover:text-white"
                      }`}
                    >
                      <span>❌</span>
                      <span>{isEn ? "Missed" : "Nesprávne"}</span>
                      <span className="font-mono text-[10px]">({lostMyPicks.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryStatusFilter("pending")}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                        historyStatusFilter === "pending"
                          ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                          : "bg-slate-800 text-amber-300 hover:text-white"
                      }`}
                    >
                      <span>⏳</span>
                      <span>{isEn ? "Pending" : "Čakajúce"}</span>
                      <span className="font-mono text-[10px]">({pendingMyPicks.length})</span>
                    </button>
                  </div>

                  {/* Type and Sort */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={historyTypeFilter}
                      onChange={(e) => setHistoryTypeFilter(e.target.value as any)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="all">{isEn ? "All Pick Types" : "Všetky typy zápasov"}</option>
                      <option value="daily">{isEn ? "🎯 Daily Picks" : "🎯 Denné tipy"}</option>
                      <option value="gotw">{isEn ? "🌟 Game of the Week" : "🌟 Zápas týždňa"}</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setHistorySortOrder(historySortOrder === "desc" ? "asc" : "desc")}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-medium text-xs flex items-center gap-1"
                    >
                      <span>{historySortOrder === "desc" ? "⬇️" : "⬆️"}</span>
                      <span>{historySortOrder === "desc" ? (isEn ? "Newest first" : "Najnovšie prvé") : (isEn ? "Oldest first" : "Najstaršie prvé")}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* LIST OF SUBMISSION CARDS */}
              {filteredHistory.length === 0 ? (
                <div className="p-12 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                  <div className="text-4xl">🏒</div>
                  <h3 className="text-base font-bold text-white">
                    {totalMyPicks === 0
                      ? (isEn ? "You haven't submitted any picks yet" : "Zatiaľ ste neodoslali žiadne tipy")
                      : (isEn ? "No picks match the selected filters" : "Žiadne tipy nezodpovedajú zvolenému filtru")}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {totalMyPicks === 0
                      ? (isEn
                          ? "Browse the games of the day in the Daily Picks tab and select your predicted winners!"
                          : "Pozrite si dnešné zápasy v záložke Denné zápasy a vyberte svojich favoritov!")
                      : (isEn
                          ? "Try changing your status or type filter above."
                          : "Skúste upraviť filter stavu alebo typu vyššie.")}
                  </p>
                  {totalMyPicks === 0 ? (
                    <button
                      type="button"
                      onClick={() => setActiveSubTab("picks")}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
                    >
                      {isEn ? "Go to Daily Picks →" : "Prejsť na Denné zápasy →"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryStatusFilter("all");
                        setHistoryTypeFilter("all");
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
                    >
                      {isEn ? "Clear filters" : "Zrušiť filtre"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredHistory.map((sub) => {
                    const game = gamesMap.get(sub.gameId);
                    const isGameFinal = game?.status === "FINAL";
                    const isDraw = isGameFinal && (game.endedIn === "OT" || game.endedIn === "SO");

                    let realWinnerId: number | null = null;
                    if (isGameFinal) {
                      if (isDraw) {
                        realWinnerId = 0; // Draw (X)
                      } else if (typeof game.homeGoals === "number" && typeof game.awayGoals === "number") {
                        realWinnerId = game.homeGoals > game.awayGoals ? game.homeTeamId : game.awayTeamId;
                      } else {
                        realWinnerId = game.winnerTeamId ?? null;
                      }
                    }

                    const isWinnerCorrect = Boolean(
                      sub.isEvaluated
                        ? sub.isGameOfTheWeek
                          ? sub.breakdown?.gotwWinner?.correct
                          : sub.breakdown?.winner?.correct || (isGameFinal && sub.winnerTeamId === realWinnerId)
                        : isGameFinal && realWinnerId !== null && sub.winnerTeamId === realWinnerId
                    );

                    const isWon = sub.isEvaluated ? sub.pointsAwarded > 0 : false;

                    let userPickTeamName = "";
                    if (sub.winnerTeamId === 0) {
                      userPickTeamName = isEn ? "Draw (Tie after 60 min)" : "Remíza (po 60 min)";
                    } else if (sub.winnerTeamId === game?.homeTeamId) {
                      userPickTeamName = game?.homeTeam?.name || (isEn ? "Home" : "Domáci");
                    } else if (sub.winnerTeamId === game?.awayTeamId) {
                      userPickTeamName = game?.awayTeam?.name || (isEn ? "Away" : "Hostia");
                    } else {
                      userPickTeamName = isEn ? "Not specified" : "Neurčené";
                    }

                    const breakdown = (sub.breakdown as Record<string, any>) || {};

                    return (
                      <div
                        key={sub.id}
                        className={`p-5 rounded-2xl border transition-all space-y-4 relative ${
                          sub.isEvaluated
                            ? isWon
                              ? "bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-950 border-emerald-500/40 shadow-lg shadow-emerald-950/20"
                              : "bg-slate-950/90 border-rose-500/30"
                            : isGameFinal
                            ? "bg-slate-950/90 border-amber-500/40"
                            : "bg-slate-950/80 border-slate-800"
                        }`}
                      >
                        {/* Header Row: Date, Type, Outcome Badge */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono text-slate-400">
                              {game?.gameDate
                                ? new Date(game.gameDate).toLocaleDateString(isEn ? "en-GB" : "sk-SK", {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                  })
                                : `${isEn ? "Round" : "Kolo"} #${game?.round || 1}`}
                            </span>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                sub.isGameOfTheWeek
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                              }`}
                            >
                              {sub.isGameOfTheWeek
                                ? `🌟 ${isEn ? "Game of the Week" : "Zápas týždňa"}`
                                : `🎯 ${isEn ? "Daily Pick" : "Denný tip"}`}
                            </span>

                            {sub.isJoker && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black">
                                🃏 {isEn ? "Joker ×3" : "Žolík ×3"}
                              </span>
                            )}
                          </div>

                          <div>
                            {sub.isEvaluated ? (
                              isWon ? (
                                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs inline-flex items-center gap-1 shadow-sm shadow-emerald-900/30">
                                  <span>✅</span>
                                  <span>{isEn ? "CORRECT" : "SPRÁVNY TIP"}</span>
                                  <span className="font-mono ml-0.5">+{sub.pointsAwarded} {isEn ? "pts" : "b"}</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold text-xs inline-flex items-center gap-1">
                                  <span>❌</span>
                                  <span>{isEn ? "MISSED" : "NESPRÁVNY TIP"}</span>
                                  <span className="font-mono ml-0.5">0 {isEn ? "pts" : "b"}</span>
                                </span>
                              )
                            ) : isGameFinal ? (
                              <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs inline-flex items-center gap-1">
                                <span>⚡</span>
                                <span>{isEn ? "Awaiting Point Tally" : "Čaká na vyhodnotenie"}</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-300 font-bold text-xs inline-flex items-center gap-1">
                                <span>⏳</span>
                                <span>{isEn ? "Awaiting Match" : "Čaká na zápas"}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Matchup Board */}
                        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80">
                          <div className="flex items-center justify-between gap-3">
                            {/* Away Team */}
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              {game?.awayTeam?.logoUrl && (
                                <div className="relative w-8 h-8 flex-shrink-0">
                                  <Image src={game.awayTeam.logoUrl} alt={game.awayTeam.name} fill className="object-contain" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-black text-white truncate">{game?.awayTeam?.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {game?.awayTeam?.gmNickname || game?.awayTeam?.gm || (game?.awayTeam?.code || "")}
                                </div>
                              </div>
                            </div>

                            {/* Center Score / Status */}
                            <div className="text-center px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 flex-shrink-0">
                              {isGameFinal ? (
                                <div>
                                  <div className="text-base font-black text-white font-mono tracking-wider">
                                    {game.awayGoals} : {game.homeGoals}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {game.endedIn ? `(${game.endedIn})` : `(${isEn ? "60 min" : "60 min"})`}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-xs font-bold text-slate-400">VS</div>
                                  <div className="text-[10px] text-slate-500">
                                    {isEn ? "Scheduled" : "Naplánovaný"}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Home Team */}
                            <div className="flex items-center gap-2.5 flex-1 justify-end text-right min-w-0">
                              <div className="min-w-0">
                                <div className="text-xs font-black text-white truncate">{game?.homeTeam?.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {game?.homeTeam?.gmNickname || game?.homeTeam?.gm || (game?.homeTeam?.code || "")}
                                </div>
                              </div>
                              {game?.homeTeam?.logoUrl && (
                                <div className="relative w-8 h-8 flex-shrink-0">
                                  <Image src={game.homeTeam.logoUrl} alt={game.homeTeam.name} fill className="object-contain" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Prediction vs Reality Details */}
                        <div className="space-y-2 text-xs">
                          {/* Winner Pick Comparison */}
                          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                {isEn ? "Your Winner Prediction (1 / X / 2):" : "Váš tip na víťaza (1 / X / 2):"}
                              </div>
                              <div className="font-bold text-white mt-0.5 flex items-center gap-1.5">
                                <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono text-[11px] font-bold">
                                  {sub.winnerTeamId === 0
                                    ? "X"
                                    : sub.winnerTeamId === game?.homeTeamId
                                    ? "1"
                                    : "2"}
                                </span>
                                <span>{userPickTeamName}</span>
                              </div>
                            </div>

                            <div>
                              {isGameFinal ? (
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <div className="text-[10px] text-slate-400">{isEn ? "Actual result:" : "Skutočný výsledok:"}</div>
                                    <div className="font-bold text-slate-200">
                                      {isDraw
                                        ? `X - ${isEn ? "Draw (OT/SO)" : "Remíza (po 60 min)"}`
                                        : realWinnerId === game?.homeTeamId
                                        ? `1 - ${game?.homeTeam?.name}`
                                        : `2 - ${game?.awayTeam?.name}`}
                                    </div>
                                  </div>
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm ${
                                    isWinnerCorrect ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                  }`}>
                                    {isWinnerCorrect ? "✓" : "✗"}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                  {isEn ? "Pending match outcome" : "Čaká na odohratie zápasu"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* GOTW Extra Predictions Breakdown */}
                          {sub.isGameOfTheWeek && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                              {/* Exact Score */}
                              <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                                <div className="text-[10px] text-slate-400">{isEn ? "Exact Score (5 pts)" : "Presné skóre (5 b)"}</div>
                                <div className="font-bold text-white font-mono">{sub.predictedScore || "—"}</div>
                                {isGameFinal && (
                                  <div className="text-[10px] flex items-center justify-between pt-1 border-t border-slate-800">
                                    <span className="text-slate-400">{isEn ? "Actual:" : "Výsledok:"} {game?.awayGoals}:{game?.homeGoals}</span>
                                    {breakdown.gotwScore?.correct ? (
                                      <span className="text-emerald-400 font-bold">✓ +5 {isEn ? "pts" : "b"}</span>
                                    ) : (
                                      <span className="text-slate-500">✗ 0 {isEn ? "pts" : "b"}</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* First Scorer */}
                              <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                                <div className="text-[10px] text-slate-400">{isEn ? "First Scorer (5 pts)" : "Prvý strelec (5 b)"}</div>
                                <div className="font-bold text-white truncate">{sub.firstGoalScorerName || "—"}</div>
                                {isGameFinal && (
                                  <div className="text-[10px] flex items-center justify-between pt-1 border-t border-slate-800">
                                    <span className="text-slate-400 truncate max-w-[90px]" title={breakdown.gotwFirstGoal?.player || breakdown.gotwFirstGoal?.actual}>
                                      {breakdown.gotwFirstGoal?.player || breakdown.gotwFirstGoal?.actual || "—"}
                                    </span>
                                    {breakdown.gotwFirstGoal?.correct ? (
                                      <span className="text-emerald-400 font-bold flex-shrink-0">✓ +5 {isEn ? "pts" : "b"}</span>
                                    ) : (
                                      <span className="text-slate-500 flex-shrink-0">✗ 0 {isEn ? "pts" : "b"}</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Top Scorer */}
                              <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                                <div className="text-[10px] text-slate-400">{isEn ? "Top Scorer (3 pts)" : "Najviac bodov (3 b)"}</div>
                                <div className="font-bold text-white truncate">{sub.topScorerPlayerName || "—"}</div>
                                {isGameFinal && (
                                  <div className="text-[10px] flex items-center justify-between pt-1 border-t border-slate-800">
                                    <span className="text-slate-400">{isEn ? "Points in game" : "Body v zápase"}</span>
                                    {breakdown.gotwTopScorer?.correct ? (
                                      <span className="text-emerald-400 font-bold">✓ +3 {isEn ? "pts" : "b"}</span>
                                    ) : (
                                      <span className="text-slate-500">✗ 0 {isEn ? "pts" : "b"}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Footer Banner */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <div>
                            {sub.createdAt && (
                              <span>
                                {isEn ? "Submitted:" : "Odoslané:"}{" "}
                                {new Date(sub.createdAt).toLocaleDateString(isEn ? "en-GB" : "sk-SK", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>

                          <div className="font-bold">
                            {sub.isEvaluated ? (
                              <span className={sub.pointsAwarded > 0 ? "text-emerald-400 font-mono" : "text-slate-400 font-mono"}>
                                {isEn ? "Total points earned" : "Celkový zisk"}: +{sub.pointsAwarded} {isEn ? "pts" : "b"}
                              </span>
                            ) : isGameFinal ? (
                              <span className="text-amber-400">
                                {isEn ? "Point evaluation pending" : "Čaká na vyhodnotenie bodov"}
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                {isEn ? "Potential win" : "Možná výhra"}: {sub.isJoker ? "6" : "2"} {isEn ? "pts" : "b"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
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
                    <span>🌟 {isEn ? "UNHL Game of the Week" : "UNHL Zápas týždňa"}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                      {isEn ? "Max 15 points" : "Max 15 bodov"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30">
                      {isEn ? "🤖 AI Pick of the Week" : "🤖 AI Zápas týždňa"}
                    </span>
                    {gotwSub && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] border border-emerald-500/30 font-bold">
                        {isEn ? "🔒 Picked & Locked" : "🔒 Natipované a zamknuté"}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                    {gotwGame.awayTeam?.name} vs {gotwGame.homeTeam?.name}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {isEn
                      ? "The special game of the week. Predict the winner (1/X/2), the exact score, the first goal scorer and the top-scoring player."
                      : "Špeciálny zápas týždňa. Tipujte víťaza (1/X/2), presné skóre, prvého strelca a najproduktívnejšieho hráča zápasu."}
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
                    <span>
                      {gotwSub
                        ? (isEn ? "🔒 Pick submitted (Locked)" : "🔒 Tip odoslaný (Zamknuté)")
                        : (isEn ? "💾 Save Game of the Week Pick" : "💾 Uložiť tip na Zápas týždňa")}
                    </span>
                  </button>
                </div>
              </div>

              {/* Matchup Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pick Winner */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    {isEn ? "1. Result after 60 min. (2 points: 1 - X - 2)" : "1. Výsledok po 60 min. (2 body: 1 - X - 2)"}
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
                      <div className="text-[10px] text-slate-400 font-mono">2 ({isEn ? "Away" : "Hostia"})</div>
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
                      <div className="text-[10px] text-slate-400 font-mono">
                        {isEn ? "Draw (OT/SO)" : "Remíza (60 min)"}
                      </div>
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
                      <div className="text-[10px] text-slate-400 font-mono">1 ({isEn ? "Home" : "Domáci"})</div>
                    </button>
                  </div>
                </div>

                {/* Exact Score */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    {isEn ? "2. Exact score (5 points)" : "2. Presné skóre (5 bodov)"}
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
                    {isEn ? "3. First goal scorer (5 points)" : "3. Prvý strelec zápasu (5 bodov)"}
                  </label>
                  <SearchablePlayerSelect
                    disabled={gotwGame.isLocked || Boolean(gotwSub)}
                    value={gotwPick.firstGoalScorerId}
                    players={players}
                    teams={teams}
                    placeholder={isEn ? "-- Select the first goal scorer --" : "-- Vyberte prvého strelca --"}
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
                    {isEn ? "4. Player with the most points in the game (3 points)" : "4. Hráč s najviac bodmi v zápase (3 body)"}
                  </label>
                  <SearchablePlayerSelect
                    disabled={gotwGame.isLocked || Boolean(gotwSub)}
                    value={gotwPick.topScorerPlayerId}
                    players={players}
                    teams={teams}
                    placeholder={isEn ? "-- Select the player with the most points --" : "-- Vyberte najproduktívnejšieho hráča --"}
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
                    {isEn
                      ? "🃏 Use the Joker on the Game of the Week (Points ×3 = up to 45 points!)"
                      : "🃏 Využiť žolíka na Zápas týždňa (Body ×3 = až do 45 bodov!)"}
                  </span>
                </label>

                <span className="text-[11px] text-slate-400 font-mono">
                  {isEn ? `You have ${jokersLeft} Jokers left` : `Máte k dispozícii ${jokersLeft} žolíkov`}
                </span>
              </div>

              {/* Bottom Save Action Bar */}
              <div className="pt-4 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-950/20 p-4 rounded-xl">
                <div className="text-xs text-slate-300">
                  {gotwSub ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      {isEn
                        ? "✅ Your Game of the Week pick has been saved and locked."
                        : "✅ Váš tip na Zápas týždňa bol uložený a uzamknutý."}
                    </span>
                  ) : (
                    <span>
                      {isEn
                        ? "Predict the result, the score and the players. After you click the button your pick is submitted and locked."
                        : "Natipujte výsledok, skóre a hráčov. Po kliknutí na tlačidlo sa tip definitívne odošle a uzamkne."}
                    </span>
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
                  <span>
                    {gotwSub
                      ? (isEn ? "🔒 Pick submitted (Locked)" : "🔒 Tip odoslaný (Zamknuté)")
                      : (isEn ? "💾 Save Game of the Week Pick" : "💾 Uložiť tip na Zápas týždňa")}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
            <div className="text-4xl">🤖</div>
            <h3 className="text-base font-bold text-white">
              {isEn ? "Game of the Week" : "Zápas týždňa"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {isEn
                ? "The AI automatically analyses the schedule and prepares the most attractive matchup of the week."
                : "AI automaticky vyhodnocuje rozpis zápasov a vyberá najatraktívnejší zápas týždňa."}
            </p>
          </div>
        )
      )}

      {/* SUBTAB 3: LEADERBOARD & MONTHLY */}
      {activeSubTab === "leaderboard" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white">
                {isEn ? "🏆 Game Picks Leaderboard (Season & Monthly)" : "🏆 Tabuľka tipérov (Celková a mesačná)"}
              </h2>
              <p className="text-xs text-slate-400">
                {isEn
                  ? "Overview of points, streaks and winners for each month."
                  : "Prehľad bodov, víťazných sérií a výsledkov za jednotlivé mesiace."}
              </p>
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
                    ? (isEn ? "Total" : "Celkovo")
                    : mKey === "2026-10"
                    ? "Oct"
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
                  <th className="py-3 px-4">{isEn ? "General Manager / Team" : "Manažér / Tím"}</th>
                  <th className="py-3 px-4 text-center">🔥 {isEn ? "Streak" : "Séria"}</th>
                  <th className="py-3 px-4 text-center">⚡ {isEn ? "Record" : "Rekord"}</th>
                  <th className="py-3 px-4 text-center">🃏 {isEn ? "Jokers" : "Žolíky"}</th>
                  <th className="py-3 px-4 text-right font-bold text-white">
                    {isEn ? "Points" : "Body"} ({selectedMonth === "all" ? (isEn ? "Total" : "Celkovo") : selectedMonth})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      {isEn ? "No entries in the picks leaderboard yet." : "Zatiaľ žiadne záznamy v tabuľke tipérov."}
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
                            {displayPts} {isEn ? "pts" : "b"}
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
              <span>🎯 {isEn ? "Games of the Day (2 points)" : "Denné zápasy (2 body)"}</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              {isEn
                ? "Every game day the system automatically selects the games of the day based on the real NHL schedule."
                : "Každý hrací deň systém automaticky vyberá zápasy dňa podľa reálneho NHL rozpisu."}
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              {isEn ? (
                <>
                  <li>You predict the result after 60 minutes: <strong className="text-white">1 (Home)</strong>, <strong className="text-white">X (Draw / overtime)</strong>, <strong className="text-white">2 (Away)</strong>.</li>
                  <li>You earn <strong className="text-white">2 points</strong> for every correct pick.</li>
                  <li>When you play a Joker, a correct pick earns up to <strong className="text-amber-400">6 points (×3)</strong>.</li>
                </>
              ) : (
                <>
                  <li>Tipujete výsledok po 60 minútach: <strong className="text-white">1 (Domáci)</strong>, <strong className="text-white">X (Remíza / predĺženie)</strong>, <strong className="text-white">2 (Hostia)</strong>.</li>
                  <li>Za každý správny tip získavate <strong className="text-white">2 body</strong>.</li>
                  <li>Pri použití žolíka získava správny tip až <strong className="text-amber-400">6 bodov (×3)</strong>.</li>
                </>
              )}
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <span>🌟 {isEn ? "Game of the Week (Max 15 pts)" : "Zápas týždňa (Max 15 b)"}</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              {isEn
                ? "One selected headline game of the week with detailed picks:"
                : "Jeden vybraný šláger týždňa s detailnými tipmi:"}
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              {isEn ? (
                <>
                  <li>Game result after 60 min. (1 - X - 2): <strong className="text-white">2 points</strong></li>
                  <li>Exact score: <strong className="text-white">5 points</strong></li>
                  <li>First goal scorer: <strong className="text-white">5 points</strong></li>
                  <li>Most points in the game: <strong className="text-white">3 points</strong></li>
                </>
              ) : (
                <>
                  <li>Výsledok zápasu po 60 min. (1 - X - 2): <strong className="text-white">2 body</strong></li>
                  <li>Presné skóre: <strong className="text-white">5 bodov</strong></li>
                  <li>Prvý strelec zápasu: <strong className="text-white">5 bodov</strong></li>
                  <li>Hráč s najviac bodmi v zápase: <strong className="text-white">3 body</strong></li>
                </>
              )}
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <span>🃏 {isEn ? "Jokers (×3)" : "Žolíky (×3)"}</span>
            </h3>
            <ul className="list-disc list-inside text-slate-400 space-y-1.5">
              <li>
                {isEn ? (
                  <><strong className="text-white">5× Joker for the season:</strong> You can use it on any game. It multiplies all points earned from that game by <strong className="text-amber-400">×3</strong> (a regular win brings 6 pts instead of 2, Game of the Week up to 45 pts)!</>
                ) : (
                  <><strong className="text-white">5× Žolík na celú sezónu:</strong> Môžete ho použiť na ľubovoľný zápas. Vynásobí všetky získané body z tohto zápasu <strong className="text-amber-400">×3</strong> (pri bežnom zápase získate až 6 b namiesto 2, pri Zápase týždňa až do 45 b)!</>
                )}
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <span>⚡ {isEn ? "Streaks, Weekly & Monthly Rewards" : "Série, týždenné a mesačné odmeny"}</span>
            </h3>
            <ul className="list-disc list-inside text-slate-400 space-y-1.5 text-xs">
              {isEn ? (
                <>
                  <li>3 correct picks in a row = <strong className="text-white">+2 bonus points</strong></li>
                  <li>5 correct picks in a row = <strong className="text-white">+5 bonus points</strong></li>
                  <li>10 correct picks in a row = <strong className="text-white">+15 bonus points</strong></li>
                  <li>
                    <strong className="text-white">Winner of the Week:</strong> The best predictor of the week earns <strong className="text-emerald-400">+$200,000</strong> for the club bank account.
                  </li>
                  <li>
                    <strong className="text-white">Monthly Champion:</strong> The winner of the month gets a 🎟️ <strong className="text-amber-300">Round 8 Draft Pick</strong> (or Round 9), <strong className="text-amber-300">+10 points</strong> and a 🥇 badge on their profile.
                  </li>
                </>
              ) : (
                <>
                  <li>3 správne tipy v rade = <strong className="text-white">+2 bonusové body</strong></li>
                  <li>5 správnych tipov v rade = <strong className="text-white">+5 bonusových bodov</strong></li>
                  <li>10 správnych tipov v rade = <strong className="text-white">+15 bonusových bodov</strong></li>
                  <li>
                    <strong className="text-white">Víťaz týždňa:</strong> Najlepší tipér týždňa získa <strong className="text-emerald-400">+$200,000</strong> na klubové konto.
                  </li>
                  <li>
                    <strong className="text-white">Mesačný šampión:</strong> Víťaz mesiaca získa 🎟️ <strong className="text-amber-300">Round 8 Draft Pick</strong> (alebo Round 9), <strong className="text-amber-300">+10 bodov</strong> a 🥇 odznak na profil.
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* REWARDS SECTION */}
          <div className="md:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-indigo-950/40 border border-amber-500/30 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 border-b border-amber-500/20 pb-3">
              <span className="text-2xl">🎁</span>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isEn ? "Official Rewards for Picks Winners (Prizes, Draft Picks & Finances)" : "Oficiálne odmeny pre víťazov tipovania (Ceny, draftové voľby & financie)"}
                </h3>
                <p className="text-xs text-slate-400">
                  {isEn
                    ? "At the end of the season, after Game Picks and Season Picks are tallied, the top three predictors are awarded club finances and draft picks:"
                    : "Na konci sezóny po sčítaní denných a sezónnych tipov získavajú najlepší traja tipéri klubové financie a draftové voľby:"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1st Place */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">🥇 {isEn ? "1st Place" : "1. Miesto"}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">{isEn ? "Champion" : "Šampión"}</span>
                </div>
                <div className="text-lg font-black text-amber-300">+$3,000,000</div>
                <ul className="text-slate-300 space-y-1 text-[11px]">
                  <li>🎟️ <strong>Round 8 Draft Pick</strong> {isEn ? "(or Round 9)" : "(alebo Round 9)"}</li>
                  <li>🥇 {isEn ? "Gold badge Season Predictor Champion" : "Zlatý odznak Šampión tipovania"}</li>
                </ul>
              </div>

              {/* 2nd Place */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">🥈 {isEn ? "2nd Place" : "2. Miesto"}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 font-bold">{isEn ? "Runner-up" : "Vicemajster"}</span>
                </div>
                <div className="text-lg font-black text-slate-200">+$1,500,000</div>
                <ul className="text-slate-300 space-y-1 text-[11px]">
                  <li>🎟️ <strong>Round 8 Draft Pick</strong> {isEn ? "(or Round 9)" : "(alebo Round 9)"}</li>
                  <li>🥈 {isEn ? "Silver badge Vice-Champion" : "Strieborný odznak Vicemajster"}</li>
                </ul>
              </div>

              {/* 3rd Place */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-700/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">🥉 {isEn ? "3rd Place" : "3. Miesto"}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-700/20 text-amber-400 font-bold">{isEn ? "3rd Place" : "3. Miesto"}</span>
                </div>
                <div className="text-lg font-black text-amber-400">+$750,000</div>
                <ul className="text-slate-300 space-y-1 text-[11px]">
                  <li>🎟️ <strong>Round 8 Draft Pick</strong> {isEn ? "(or Round 9)" : "(alebo Round 9)"}</li>
                  <li>🥉 {isEn ? "Bronze badge 3rd Place" : "Bronzový odznak 3. Miesto"}</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                <strong className="text-emerald-400">{isEn ? "📅 Weekly Game Picks:" : "📅 Týždenné tipovanie:"}</strong>{" "}
                {isEn
                  ? "Every winner of a game week in Game Picks earns +$200,000 for the club bank account."
                  : "Každý víťaz hracieho týždňa v Game Picks získa +$200,000 na klubové konto."}
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                <strong className="text-amber-300">{isEn ? "🏆 Monthly Champion:" : "🏆 Mesačný šampión:"}</strong>{" "}
                {isEn
                  ? "Every winner of the month gets a Round 8 Draft Pick (or Round 9), +10 points and a badge."
                  : "Každý víťaz mesiaca získa Round 8 Draft Pick (alebo Round 9), +10 bodov a odznak."}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              ℹ️ <strong>{isEn ? "Draft Pick rule:" : "Pravidlo pre draftové voľby:"}</strong>{" "}
              {isEn
                ? "All bonus draft picks (the season TOP 3 and monthly champions) are generated in Round 8 of the rookie draft. If all 32 positions in Round 8 are already taken, the pick is automatically recorded in Round 9."
                : "Všetky bonusové draftové voľby (sezónne TOP 3 aj mesační šampióni) sa generujú v 8. kole nováčikovského draftu. V prípade obsadenia všetkých 32 pozícií v 8. kole sa voľba automaticky zapíše do 9. kola."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
