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
              placeholder="🔍 Hľadať hráča..."
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
              -- Nevybrané --
            </button>

            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                Nenašiel sa žiadny hráč
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
      setMsg({ type: "error", text: "Pre odoslanie tipov sa prihláste ako GM tímu." });
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
        setMsg({ type: "error", text: "Všetky vybrané zápasy už boli odoslané a sú uzamknuté." });
      } else {
        setMsg({ type: "error", text: "Vyberte aspoň jedného víťaza zápasu." });
      }
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveDailyGamePicksAction(unsubmittedPayload, config.season, config.league);
        if (res.ok) {
          setMsg({ type: "success", text: "✅ Vaše denné tipy boli úspešne uložené a uzamknuté!" });
        } else {
          setMsg({ type: "error", text: res.error || "Chyba pri ukladaní tipov." });
        }
      } catch (err: any) {
        console.error("Save daily picks error:", err);
        alert("Aplikácia bola na serveri aktualizovaná na novú verziu. Stránka sa teraz obnoví, prosím zopakujte odoslanie tipov.");
        window.location.reload();
      }
    });
  };

  const handleSaveGotw = () => {
    if (!viewerTeam) {
      setMsg({ type: "error", text: "Pre odoslanie tipu sa prihláste ako GM tímu." });
      return;
    }
    if (!gotwGame || gotwPick.winnerTeamId === undefined) {
      setMsg({ type: "error", text: "Vyberte víťaza zápasu týždňa (alebo remízu)." });
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
          setMsg({ type: "success", text: "✅ Tip na Zápas týždňa (Game of the Week) bol úspešne uložený!" });
        } else {
          setMsg({ type: "error", text: res.error || "Chyba pri ukladaní tipu." });
        }
      } catch (err: any) {
        console.error("Save GOTW error:", err);
        alert("Aplikácia bola na serveri aktualizovaná na novú verziu. Stránka sa teraz obnoví, prosím zopakujte odoslanie tipu.");
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
          setMsg({ type: "error", text: (res as any).error || "Chyba pri vyhodnocovaní." });
        }
      } catch (err: any) {
        console.error("Evaluate error:", err);
        alert("Aplikácia bola na serveri aktualizovaná. Stránka sa teraz obnoví.");
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
                <div className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">Môj Profil Tipéra</div>
                <div className="text-lg font-black text-white flex items-center gap-2">
                  <span>{viewerTeam.gmNickname || viewerTeam.gm || viewerTeam.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                    {viewerProfile.totalPoints} bodov
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Streak Badge */}
              <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
                <span className="text-base">🔥</span>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Séria (Streak)</div>
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
                    {jokersLeft} / {viewerProfile.jokersTotal} k dispozícii
                  </div>
                </div>
              </div>

              {/* Rival Matchup */}
              {currentRival && (
                <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-rose-500/30 flex items-center gap-2">
                  <span className="text-base">⚔️</span>
                  <div>
                    <div className="text-[10px] text-rose-300 font-medium">Rival Týždňa #{currentRival.week}</div>
                    <div className="font-bold text-white truncate max-w-[120px]">
                      vs {currentRival.rivalTeam?.name || "Súper"}
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
            <span>🎯 Zápasy Dňa (2b)</span>
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
              {gotwGame ? "15 b" : "Čaká na výber"}
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
            <span>🏆 Rebríček Game Picks</span>
          </button>

          <button
            onClick={() => setActiveSubTab("rules")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "rules"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-slate-800/80 text-slate-400 hover:bg-slate-800"
            }`}
          >
            <span>📖 Pravidlá & Bodovanie</span>
          </button>
        </div>

        {isAdmin && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleEvaluate}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-600/20 disabled:opacity-50"
          >
            <span>⚡ Spustiť Vyhodnotenie Zápasov</span>
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
            Zavrieť
          </button>
        </div>
      )}

      {/* SUBTAB 1: DAILY PICKS */}
      {activeSubTab === "picks" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🎯 UNHL Game of the Day / Zápasová Tipovačka</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tipujte výsledok po základnom hracom čase (60 min): <strong>1 (Výhra domácich)</strong>, <strong>X (Remíza / predĺženie)</strong>, <strong>2 (Výhra hostí)</strong>. Správny tip = <strong>2 body</strong> (alebo <strong>6b s Jokerom ×3</strong>).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveDaily}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex-shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>💾 Uložiť Denné Tipy</span>
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
              <span>🔥 Dnešné zápasy</span>
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
              <span>📅 Všetky nadchádzajúce zápasy</span>
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
              <span>📜 Nedávne výsledky</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                {finalGames.length}
              </span>
            </button>
          </div>

          {gamesToDisplay.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
              <div className="text-3xl">📅</div>
              <div className="text-sm font-bold text-white">Žiadne zápasy v tejto kategórii</div>
              <div className="text-xs text-slate-400 max-w-md mx-auto">
                Skontrolujte ostatné filtre alebo sledujte zápasový kalendár pred začiatkom nového hracieho kola.
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
                            {g.status === "FINAL" ? `FINAL ${g.homeGoals}:${g.awayGoals}` : "🔒 Uzamknuté"}
                          </span>
                        ) : sub ? (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px] border border-indigo-500/30">
                            🔒 Natipované
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                            🟢 Otvorené
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
                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">Remíza (60 min)</span>
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
                      <span className="text-[11px] text-slate-400">Výhra: <strong className="text-indigo-300">2b</strong></span>
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
                          🃏 Joker (×3 = 6b)
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
                      Max 15 bodov
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30">
                      🤖 AI Výber Týždňa
                    </span>
                    {gotwSub && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] border border-emerald-500/30 font-bold">
                        🔒 Natipované & Uzamknuté
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                    {gotwGame.awayTeam?.name} vs {gotwGame.homeTeam?.name}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Špeciálny zápas týždňa. Natipujte víťaza (1/X/2), presné skóre, prvého strelca a top bodujúceho hráča.
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
                    <span>{gotwSub ? "🔒 Tip odoslaný (Uzamknuté)" : "💾 Uložiť Tip na Zápas Týždňa"}</span>
                  </button>
                </div>
              </div>

              {/* Matchup Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pick Winner */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    1. Výsledok po 60 min. (2 body: 1 - X - 2)
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
                      <div className="text-[10px] text-slate-400 font-mono">Remíza (OT/SO)</div>
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
                    2. Presné skóre (5 bodov)
                  </label>
                  <input
                    type="text"
                    disabled={gotwGame.isLocked || Boolean(gotwSub)}
                    placeholder="napr. 5:3 alebo 4:2"
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
                    3. Prvý strelec zápasu (5 bodov)
                  </label>
                  <SearchablePlayerSelect
                    disabled={gotwGame.isLocked || Boolean(gotwSub)}
                    value={gotwPick.firstGoalScorerId}
                    players={players}
                    teams={teams}
                    placeholder="-- Vyberte prvého strelca gólu --"
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
                    4. Hráč s najviac bodmi v zápase (3 body)
                  </label>
                  <SearchablePlayerSelect
                    disabled={gotwGame.isLocked || Boolean(gotwSub)}
                    value={gotwPick.topScorerPlayerId}
                    players={players}
                    teams={teams}
                    placeholder="-- Vyberte hráča s najviac bodmi --"
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
                    🃏 Použiť Jokera na Zápas Týždňa (Body ×3 = až 45 bodov!)
                  </span>
                </label>

                <span className="text-[11px] text-slate-400 font-mono">
                  Zostáva vám {jokersLeft} Jokerov
                </span>
              </div>

              {/* Bottom Save Action Bar */}
              <div className="pt-4 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-950/20 p-4 rounded-xl">
                <div className="text-xs text-slate-300">
                  {gotwSub ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      ✅ Váš tip na Zápas týždňa je úspešne uložený a uzamknutý.
                    </span>
                  ) : (
                    <span>Tipujte výsledok, skóre a hráčov. Po kliknutí na tlačidlo sa váš tip odošle a uzamkne.</span>
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
                  <span>{gotwSub ? "🔒 Tip odoslaný (Uzamknuté)" : "💾 Uložiť Tip na Zápas Týždňa"}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
            <div className="text-4xl">🤖</div>
            <h3 className="text-base font-bold text-white">Zápas Týždňa (Game of the Week)</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              AI automaticky analyzuje rozpis zápasov a pripravuje najatraktívnejší duel týždňa.
            </p>
          </div>
        )
      )}

      {/* SUBTAB 3: LEADERBOARD & MONTHLY */}
      {activeSubTab === "leaderboard" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white">🏆 Rebríček Game Picks (Celosezónny & Mesačný)</h2>
              <p className="text-xs text-slate-400">Prehľad bodov, streakov a víťazov jednotlivých mesiacov.</p>
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
                  <th className="py-3 px-4">Generálny Manažér / Tím</th>
                  <th className="py-3 px-4 text-center">🔥 Streak</th>
                  <th className="py-3 px-4 text-center">⚡ Rekord</th>
                  <th className="py-3 px-4 text-center">🃏 Jokeri</th>
                  <th className="py-3 px-4 text-right font-bold text-white">Body ({selectedMonth === "all" ? "Celkovo" : selectedMonth})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Zatiaľ žiadne záznamy v rebríčku tipovačky.
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
              <span>🎯 Zápasy Dňa (2 body)</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Každý hrací deň systém automaticky vyberie zápasy dňa podľa reálneho NHL programu.
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li>Tipuje sa výsledok po 60 minútach: <strong className="text-white">1 (Domáci)</strong>, <strong className="text-white">X (Remíza / predĺženie)</strong>, <strong className="text-white">2 (Hostia)</strong>.</li>
              <li>Za každý správny tip získate <strong className="text-white">2 body</strong>.</li>
              <li>Pri nasadení Jokera získate za správny tip až <strong className="text-amber-400">6 bodov (×3)</strong>.</li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <span>🌟 Game of the Week (Max 15b)</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Jeden vybraný šláger týždňa s podrobnými tipmi:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li>Výsledok zápasu po 60 min. (1 - X - 2): <strong className="text-white">2 body</strong></li>
              <li>Presné skóre: <strong className="text-white">5 bodov</strong></li>
              <li>Prvý strelec zápasu: <strong className="text-white">5 bodov</strong></li>
              <li>Najviac bodov v zápase: <strong className="text-white">3 body</strong></li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <span>🃏 Jokeri (×3)</span>
            </h3>
            <ul className="list-disc list-inside text-slate-400 space-y-1.5">
              <li>
                <strong className="text-white">5× Joker na celú sezónu:</strong> Môžete ho použiť na ľubovoľný zápas. Násobí všetky získané body z daného zápasu <strong className="text-amber-400">×3</strong> (pri bežnom zápase získate namiesto 2b až 6b, pri Game of the Week až do 45b)!
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <span>⚡ Série, 📅 Týždenné & Mesačné Odmeny</span>
            </h3>
            <ul className="list-disc list-inside text-slate-400 space-y-1.5 text-xs">
              <li>3 správne tipy v rade = <strong className="text-white">+2 bonusové body</strong></li>
              <li>5 správnych tipov v rade = <strong className="text-white">+5 bonusových bodov</strong></li>
              <li>10 správnych tipov v rade = <strong className="text-white">+15 bonusových bodov</strong></li>
              <li>
                <strong className="text-white">Víťaz Týždňa:</strong> Najlepší tipér týždňa získa <strong className="text-emerald-400">+$200,000</strong> do klubovej kasy.
              </li>
              <li>
                <strong className="text-white">Mesačný Šampión:</strong> Víťaz mesiaca získa 🎟️ <strong className="text-amber-300">Draft Pick v 8. kole</strong> (alebo 9. kole), <strong className="text-amber-300">+10 bodov</strong> a odznak 🥇 na profile.
              </li>
            </ul>
          </div>

          {/* REWARDS SECTION */}
          <div className="md:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-indigo-950/40 border border-amber-500/30 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 border-b border-amber-500/20 pb-3">
              <span className="text-2xl">🎁</span>
              <div>
                <h3 className="text-base font-bold text-white">Oficiálne Odmeny pre Víťazov Tipovačky (Ceny, Draft Picky & Financie)</h3>
                <p className="text-xs text-slate-400">
                  Na konci sezóny sa po sčítaní Game Picks a Season Picks udelia všetkým trom špičkovým tipérom klubové financie a draft picky:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1st Place */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">🥇 1. Miesto</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">Šampión</span>
                </div>
                <div className="text-lg font-black text-amber-300">+$3,000,000</div>
                <ul className="text-slate-300 space-y-1 text-[11px]">
                  <li>🎟️ <strong>Draft Pick v 8. kole</strong> (alebo 9. kole)</li>
                  <li>🥇 Zlatý odznak <strong>Season Predictor Champion</strong></li>
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
                  <li>🎟️ <strong>Draft Pick v 8. kole</strong> (alebo 9. kole)</li>
                  <li>🥈 Strieborný odznak <strong>Vice-Champion</strong></li>
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
                  <li>🎟️ <strong>Draft Pick v 8. kole</strong> (alebo 9. kole)</li>
                  <li>🥉 Bronzový odznak <strong>3rd Place</strong></li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                <strong className="text-emerald-400">📅 Týždenné Game Picks:</strong> Každý víťaz hracieho týždňa v Game Picks získa <strong>+$200,000</strong> do klubovej kasy.
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                <strong className="text-amber-300">🏆 Mesačný Šampión:</strong> Každý víťaz mesiaca získa 🎟️ <strong>Draft Pick v 8. kole</strong> (alebo 9. kole), <strong>+10 bodov</strong> a odznak.
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              ℹ️ <strong>Pravidlo pre Draft Picky:</strong> Všetky bonusové draft picky (celoročná TOP 3 aj mesační šampióni) sa generujú do <strong>8. kola</strong> draftu nováčikov. V prípade, že je v 8. kole už obsadených všetkých 32 pozícií, pick sa automaticky zapíše do <strong>9. kola</strong>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
