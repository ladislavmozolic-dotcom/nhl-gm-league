"use client";

import React, { useState, useTransition } from "react";
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

  // Form State for Daily Games
  const subMap = new Map(viewerSubmissions.map((s) => [s.gameId, s]));
  const [dailyPicks, setDailyPicks] = useState<Record<number, { winnerTeamId?: number; confidence: number; isUpsetPick?: boolean; isJoker?: boolean }>>(() => {
    const init: Record<number, any> = {};
    for (const g of games) {
      const sub = subMap.get(g.id);
      if (sub && !sub.isGameOfTheWeek) {
        init[g.id] = {
          winnerTeamId: sub.winnerTeamId,
          confidence: sub.confidence || 2,
          isUpsetPick: sub.isUpsetPick || false,
          isJoker: sub.isJoker || false,
        };
      } else {
        init[g.id] = {
          winnerTeamId: undefined,
          confidence: 2,
          isUpsetPick: false,
          isJoker: false,
        };
      }
    }
    return init;
  });

  // Form State for Game of the Week
  const gotwGame = games.find((g) => g.isGameOfTheWeek);
  const gotwSub = gotwGame ? subMap.get(gotwGame.id) : null;
  const [gotwPick, setGotwPick] = useState({
    winnerTeamId: gotwSub?.winnerTeamId,
    predictedScore: gotwSub?.predictedScore || "4:2",
    firstGoalScorerId: gotwSub?.firstGoalScorerId,
    firstGoalScorerName: gotwSub?.firstGoalScorerName,
    topScorerPlayerId: gotwSub?.topScorerPlayerId,
    topScorerPlayerName: gotwSub?.topScorerPlayerName,
    isJoker: gotwSub?.isJoker || false,
  });

  // Featured games (Games of the Day) vs regular
  const featuredGames = games.filter((g) => g.isFeatured && !g.isGameOfTheWeek);

  const jokersLeft = viewerProfile ? viewerProfile.jokersTotal - viewerProfile.jokersUsed : 5;

  const handleSaveDaily = () => {
    if (!viewerTeam) {
      setMsg({ type: "error", text: "Pre odoslanie tipov sa prihláste ako GM tímu." });
      return;
    }

    const payload = Object.entries(dailyPicks)
      .filter(([gId, p]) => p.winnerTeamId !== undefined)
      .map(([gId, p]) => ({
        gameId: Number(gId),
        winnerTeamId: p.winnerTeamId!,
        confidence: p.confidence,
        isUpsetPick: p.isUpsetPick,
        isJoker: p.isJoker,
      }));

    if (payload.length === 0) {
      setMsg({ type: "error", text: "Vyberte aspoň jedného víťaza zápasu." });
      return;
    }

    startTransition(async () => {
      const res = await saveDailyGamePicksAction(payload, config.season, config.league);
      if (res.ok) {
        setMsg({ type: "success", text: "✅ Vaše denné tipy boli úspešne uložené!" });
      } else {
        setMsg({ type: "error", text: res.error || "Chyba pri ukladaní tipov." });
      }
    });
  };

  const handleSaveGotw = () => {
    if (!viewerTeam) {
      setMsg({ type: "error", text: "Pre odoslanie tipu sa prihláste ako GM tímu." });
      return;
    }
    if (!gotwGame || !gotwPick.winnerTeamId) {
      setMsg({ type: "error", text: "Vyberte víťaza zápasu týždňa." });
      return;
    }

    startTransition(async () => {
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
    });
  };

  const handleEvaluate = () => {
    startTransition(async () => {
      const res = await evaluateGamePicksAction(config.season, config.league);
      if (res.ok && "message" in res) {
        setMsg({ type: "success", text: `⚡ ${res.message}` });
      } else {
        setMsg({ type: "error", text: (res as any).error || "Chyba pri vyhodnocovaní." });
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
            <span>🎯 Zápasy Dňa (Confidence 1–3)</span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-950/80 text-[10px] text-indigo-300 font-mono">
              {featuredGames.length}
            </span>
          </button>

          {gotwGame && (
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
                15 b
              </span>
            </button>
          )}

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

      {/* SUBTAB 1: DAILY CONFIDENCE PICKS */}
      {activeSubTab === "picks" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🎯 UNHL Game of the Day / Vybrané Zápasy</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Vyberte víťaza zápasu a priraďte mieru dôvery (Confidence 1, 2 alebo 3 body). Môžete nasadiť aj strategického <strong>Jokera (×3)</strong> alebo označiť <strong>Upset Pick (+5b)</strong>.
              </p>
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveDaily}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex-shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span>💾 Uložiť Denné Tipy</span>
            </button>
          </div>

          {featuredGames.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
              <div className="text-3xl">📅</div>
              <div className="text-sm font-bold text-white">Žiadne naplánované zápasy dňa</div>
              <div className="text-xs text-slate-400 max-w-md mx-auto">
                Na najbližšie dni nie sú vybrané žiadne zápasy. Sledujte zápasový kalendár pred začiatkom nového hracieho kola.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredGames.map((g) => {
                const current = dailyPicks[g.id] || { confidence: 2 };
                const sub = subMap.get(g.id);
                const isLocked = g.isLocked;

                return (
                  <div
                    key={g.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 relative ${
                      sub?.isEvaluated
                        ? sub.pointsAwarded > 0
                          ? "bg-emerald-950/20 border-emerald-500/40"
                          : "bg-rose-950/20 border-rose-500/30"
                        : current.winnerTeamId
                        ? "bg-slate-900 border-indigo-500/40 shadow-lg shadow-indigo-950/30"
                        : "bg-slate-950/70 border-slate-800"
                    }`}
                  >
                    {/* Header: Date & Badges */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono">
                        {g.gameDate
                          ? new Date(g.gameDate).toLocaleDateString("sk-SK", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })
                          : `Deň #${g.round || 1}`}
                      </span>

                      <div className="flex items-center gap-1">
                        {isLocked ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                            {g.status === "FINAL" ? `FINAL ${g.homeGoals}:${g.awayGoals}` : "🔒 Uzamknuté"}
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

                    {/* Matchup Team Selection Buttons (1 vs 2) */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Away Team */}
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setDailyPicks({
                            ...dailyPicks,
                            [g.id]: { ...current, winnerTeamId: g.awayTeamId },
                          })
                        }
                        className={`p-2.5 rounded-xl border text-left transition-all relative ${
                          current.winnerTeamId === g.awayTeamId
                            ? "bg-indigo-600 border-indigo-400 text-white font-bold shadow-md shadow-indigo-600/30"
                            : "bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {g.awayTeam?.logoUrl && (
                            <div className="relative w-7 h-7 flex-shrink-0">
                              <Image src={g.awayTeam.logoUrl} alt={g.awayTeam.name} fill className="object-contain" />
                            </div>
                          )}
                          <div className="truncate">
                            <div className="text-xs truncate font-bold">{g.awayTeam?.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Hostia</div>
                          </div>
                        </div>
                        {g.isAwayUpset && (
                          <span className="absolute top-1 right-1 text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-mono">
                            ⚡ Outsider
                          </span>
                        )}
                      </button>

                      {/* Home Team */}
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setDailyPicks({
                            ...dailyPicks,
                            [g.id]: { ...current, winnerTeamId: g.homeTeamId },
                          })
                        }
                        className={`p-2.5 rounded-xl border text-left transition-all relative ${
                          current.winnerTeamId === g.homeTeamId
                            ? "bg-indigo-600 border-indigo-400 text-white font-bold shadow-md shadow-indigo-600/30"
                            : "bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {g.homeTeam?.logoUrl && (
                            <div className="relative w-7 h-7 flex-shrink-0">
                              <Image src={g.homeTeam.logoUrl} alt={g.homeTeam.name} fill className="object-contain" />
                            </div>
                          )}
                          <div className="truncate">
                            <div className="text-xs truncate font-bold">{g.homeTeam?.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Doma</div>
                          </div>
                        </div>
                        {g.isHomeUpset && (
                          <span className="absolute top-1 right-1 text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-mono">
                            ⚡ Outsider
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Confidence Selector 1, 2, 3 */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px] font-medium">Confidence:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3].map((cVal) => (
                          <button
                            key={cVal}
                            type="button"
                            disabled={isLocked}
                            onClick={() =>
                              setDailyPicks({
                                ...dailyPicks,
                                [g.id]: { ...current, confidence: cVal },
                              })
                            }
                            className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                              current.confidence === cVal
                                ? "bg-indigo-600 text-white shadow"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            }`}
                          >
                            {cVal === 3 ? "★★★ 3b" : cVal === 2 ? "★★☆ 2b" : "★☆☆ 1b"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Modifiers: Joker & Upset */}
                    <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                      {/* Joker Checkbox */}
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
                          🃏 Joker (×3)
                        </span>
                      </label>

                      {/* Upset Checkbox */}
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={current.isUpsetPick || false}
                          onChange={(e) =>
                            setDailyPicks({
                              ...dailyPicks,
                              [g.id]: { ...current, isUpsetPick: e.target.checked },
                            })
                          }
                          className="rounded border-slate-700 text-amber-600 focus:ring-amber-500 bg-slate-900"
                        />
                        <span className={current.isUpsetPick ? "font-bold text-amber-300" : ""}>
                          🔥 Upset (+5b)
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
      {activeSubTab === "gotw" && gotwGame && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
              <div>
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🌟 UNHL Game of the Week</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                    Max 15 bodov
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  {gotwGame.awayTeam?.name} vs {gotwGame.homeTeam?.name}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Špeciálny zápas týždňa. Natipujte víťaza, presné skóre, prvého strelca a najproduktívnejšieho hráča.
                </p>
              </div>

              <button
                type="button"
                disabled={isPending || gotwGame.isLocked}
                onClick={handleSaveGotw}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-lg shadow-amber-600/30 flex-shrink-0 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>💾 Uložiť Tip na Zápas Týždňa</span>
              </button>
            </div>

            {/* Matchup Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pick Winner */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  1. Víťaz zápasu (2 body)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={gotwGame.isLocked}
                    onClick={() => setGotwPick({ ...gotwPick, winnerTeamId: gotwGame.awayTeamId })}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      gotwPick.winnerTeamId === gotwGame.awayTeamId
                        ? "bg-amber-600 border-amber-400 text-white font-bold shadow-lg"
                        : "bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="text-sm font-bold">{gotwGame.awayTeam?.name}</div>
                    <div className="text-[10px] text-slate-400">Hostia</div>
                  </button>

                  <button
                    type="button"
                    disabled={gotwGame.isLocked}
                    onClick={() => setGotwPick({ ...gotwPick, winnerTeamId: gotwGame.homeTeamId })}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      gotwPick.winnerTeamId === gotwGame.homeTeamId
                        ? "bg-amber-600 border-amber-400 text-white font-bold shadow-lg"
                        : "bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="text-sm font-bold">{gotwGame.homeTeam?.name}</div>
                    <div className="text-[10px] text-slate-400">Doma</div>
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
                  disabled={gotwGame.isLocked}
                  placeholder="napr. 5:3 alebo 4:2"
                  value={gotwPick.predictedScore}
                  onChange={(e) => setGotwPick({ ...gotwPick, predictedScore: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950/90 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* First Goal Scorer */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  3. Prvý strelec zápasu (5 bodov)
                </label>
                <SearchablePlayerSelect
                  disabled={gotwGame.isLocked}
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
                  disabled={gotwGame.isLocked}
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
                  disabled={gotwGame.isLocked || (jokersLeft <= 0 && !gotwPick.isJoker)}
                  checked={gotwPick.isJoker || false}
                  onChange={(e) => setGotwPick({ ...gotwPick, isJoker: e.target.checked })}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900"
                />
                <span className="font-bold text-amber-300">
                  🃏 Použiť Jokera na Zápas Týždňa (Body ×3 = až 45 bodov!)
                </span>
              </label>

              <span className="text-[11px] text-slate-400 font-mono">
                Zostáva vám {jokersLeft} Jokerov
              </span>
            </div>
          </div>
        </div>
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
              <span>🎯 Zápasy Dňa & Confidence Body</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Každý hrací deň systém automaticky vyberie 3 zápasy dňa. GM tipuje víťaza a priradí body dôvery:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li><strong className="text-white">★★★ Confidence 3</strong> = 3 body pri zásahu</li>
              <li><strong className="text-white">★★☆ Confidence 2</strong> = 2 body pri zásahu</li>
              <li><strong className="text-white">★☆☆ Confidence 1</strong> = 1 bod pri zásahu</li>
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
              <li>Víťaz zápasu: <strong className="text-white">2 body</strong></li>
              <li>Presné skóre: <strong className="text-white">5 bodov</strong></li>
              <li>Prvý strelec zápasu: <strong className="text-white">5 bodov</strong></li>
              <li>Najviac bodov v zápase: <strong className="text-white">3 body</strong></li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <span>🃏 Jokeri & 🔥 Upset Pick</span>
            </h3>
            <ul className="list-disc list-inside text-slate-400 space-y-1.5">
              <li>
                <strong className="text-white">5× Joker na sezónu:</strong> Násobí všetky získané body z daného zápasu <strong className="text-amber-400">×3</strong>!
              </li>
              <li>
                <strong className="text-white">Upset Pick (1× týždenne):</strong> Označte outsidera. Ak zvíťazí, získate bonus <strong className="text-amber-300">+5 bodov</strong>.
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <span>⚡ Série (Streaks) & 🥇 Mesační Šampióni</span>
            </h3>
            <ul className="list-disc list-inside text-slate-400 space-y-1.5">
              <li>3 správne tipy v rade = <strong className="text-white">+2 bonusové body</strong></li>
              <li>5 správnych tipov v rade = <strong className="text-white">+5 bonusových bodov</strong></li>
              <li>10 správnych tipov v rade = <strong className="text-white">+15 bonusových bodov</strong></li>
              <li>
                Najlepší tipér každého kalendárneho mesiaca získa <strong className="text-amber-300">+10 Season Points</strong> a prestížny odznak 🥇.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
