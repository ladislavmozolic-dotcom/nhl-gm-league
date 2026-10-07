"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Image from "next/image";
import {
  saveSeasonPicksAction,
  updateSeasonPicksConfigAction,
  evaluateSeasonPicksAction,
} from "./actions";
import GamePicksView from "./GamePicksView";
import { useLang } from "@/components/LangProvider";
import type {
  SeasonPicksFormData,
  SectionPointsBreakdown,
  OverUnderQuestion,
  H2HDuel,
  BoldStatement,
} from "@/lib/season-picks-server";

function SearchablePlayerSelect({
  value,
  onChange,
  players,
  teams,
  placeholder = "-- Select a player --",
  disabled = false,
  filter,
}: {
  value?: number;
  onChange: (playerId?: number, player?: any) => void;
  players: any[];
  teams: any[];
  placeholder?: string;
  disabled?: boolean;
  filter?: (p: any) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const selectedPlayer = value ? players.find((p) => p.id === value) : null;
  const selectedTeam = selectedPlayer?.teamId ? teamById.get(selectedPlayer.teamId) : null;

  const eligiblePlayers = filter ? players.filter(filter) : players;
  const filtered = query.trim()
    ? eligiblePlayers.filter((p) => {
        const q = query.toLowerCase();
        const t = p.teamId ? teamById.get(p.teamId) : null;
        return (
          p.name.toLowerCase().includes(q) ||
          p.position?.toLowerCase().includes(q) ||
          t?.name.toLowerCase().includes(q) ||
          t?.code?.toLowerCase().includes(q)
        );
      })
    : eligiblePlayers;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-950 border rounded-xl text-left text-sm transition-all ${
          disabled
            ? "opacity-60 cursor-not-allowed border-slate-800"
            : open
            ? "border-indigo-500 ring-2 ring-indigo-500/20"
            : "border-slate-700 hover:border-slate-600"
        }`}
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
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">
              {selectedPlayer.position}
            </span>
            {selectedTeam && (
              <span className="text-xs text-slate-400 truncate">
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
              placeholder="🔍 Search player by name, team..."
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
                No player found for &quot;{query}&quot;
              </div>
            ) : (
              filtered.slice(0, 50).map((p) => {
                const tm = p.teamId ? teamById.get(p.teamId) : null;
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

const TOP_90_POINT_TEAMS = [
  "NEW YORK RANGERS",
  "DALLAS STARS",
  "CAROLINA HURRICANES",
  "FLORIDA PANTHERS",
  "WINNIPEG JETS",
  "BOSTON BRUINS",
  "VANCOUVER CANUCKS",
  "COLORADO AVALANCHE",
  "EDMONTON OILERS",
  "TORONTO MAPLE LEAFS",
  "NASHVILLE PREDATORS",
  "LOS ANGELES KINGS",
  "TAMPA BAY LIGHTNING",
  "VEGAS GOLDEN KNIGHTS",
  "NEW YORK ISLANDERS",
  "WASHINGTON CAPITALS",
];

const TROPHIES_LIST = [
  { key: "Hart", name: "Hart Memorial Trophy", desc: "Most valuable player (MVP) of the regular season" },
  { key: "Norris", name: "James Norris Memorial Trophy", desc: "Best defenseman" },
  { key: "Vezina", name: "Vezina Trophy", desc: "Best goalie" },
  { key: "Calder", name: "Calder Memorial Trophy", desc: "Rookie of the year" },
  { key: "Selke", name: "Frank J. Selke Trophy", desc: "Best defensive forward" },
  { key: "JackAdams", name: "Jack Adams Award", desc: "Coach of the year" },
];

export default function SeasonPicksView({
  initialData,
  viewerTeam,
  isAdmin,
}: {
  initialData: any;
  viewerTeam: { id: number; name: string; slug: string; logoUrl: string | null; gm?: string; gmNickname?: string | null } | null;
  isAdmin: boolean;
}) {
  const lang = useLang();
  const isEn = lang === "en";

  const [tab, setTab] = useState<"picks" | "leaderboard" | "daily" | "rules" | "admin">("picks");
  const [config, setConfig] = useState(initialData.config);
  const [submissions, setSubmissions] = useState(initialData.submissions || []);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  // Form state
  const defaultPicks: SeasonPicksFormData = initialData.mySubmission?.picks || {
    stanleyCup: { seriesScore: "4:2" },
    divisionWinners: {},
    presidentsTrophy: { points: 112 },
    playoffTeams: [],
    statLeaders: {},
    trophies: TROPHIES_LIST.map((t) => ({ key: t.key, name: t.name })),
    overUnder: {},
    h2h: {},
    bold: {},
    wildcard: {},
  };

  const [formPicks, setFormPicks] = useState<SeasonPicksFormData>(defaultPicks);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasSubmitted = Boolean(initialData.mySubmission);
  const isLocked = (config.isLocked || hasSubmitted) && !isAdmin;

  // Restore draft from localStorage on load if not yet submitted
  useEffect(() => {
    if (!hasSubmitted && viewerTeam?.id) {
      try {
        const saved = localStorage.getItem(`unhl_season_picks_draft_${viewerTeam.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            setFormPicks((prev) => ({ ...prev, ...parsed }));
          }
        }
      } catch (e) {
        console.warn("Failed to load picks draft from localStorage", e);
      }
    }
  }, [hasSubmitted, viewerTeam?.id]);

  // Auto-save draft changes to localStorage
  useEffect(() => {
    if (!hasSubmitted && !isLocked && viewerTeam?.id) {
      try {
        localStorage.setItem(`unhl_season_picks_draft_${viewerTeam.id}`, JSON.stringify(formPicks));
      } catch (e) {
        // quota exceeded or private mode
      }
    }
  }, [formPicks, hasSubmitted, isLocked, viewerTeam?.id]);

  const teams = initialData.teams || [];
  const players = initialData.players || [];

  const eastTeams = teams.filter((t: any) => t.conference?.toLowerCase().includes("east"));
  const westTeams = teams.filter((t: any) => t.conference?.toLowerCase().includes("west"));

  const atlanticTeams = teams.filter((t: any) => t.division?.toLowerCase().includes("atlantic"));
  const metroTeams = teams.filter((t: any) => t.division?.toLowerCase().includes("metropolitan"));
  const centralTeams = teams.filter((t: any) => t.division?.toLowerCase().includes("central"));
  const pacificTeams = teams.filter((t: any) => t.division?.toLowerCase().includes("pacific"));

  const bustEligibleTeams = teams.filter((t: any) =>
    TOP_90_POINT_TEAMS.some((top) => t.name.toUpperCase().includes(top))
  );

  const ouQuestions: OverUnderQuestion[] = config.overUnderQuestions || [];
  const h2hDuels: H2HDuel[] = config.h2hDuels || [];
  const boldStatements: BoldStatement[] = config.boldStatements || [];

  const trophyPicks = formPicks.trophies || [];

  // Playoff team selection helper
  const selectedPlayoffs = new Set(formPicks.playoffTeams || []);
  const eastSelectedCount = (formPicks.playoffTeams || []).filter((id) =>
    eastTeams.some((t: any) => t.id === id)
  ).length;
  const westSelectedCount = (formPicks.playoffTeams || []).filter((id) =>
    westTeams.some((t: any) => t.id === id)
  ).length;

  const togglePlayoffTeam = (teamId: number, conf: "east" | "west") => {
    if (isLocked) return;
    const current = new Set(formPicks.playoffTeams || []);
    if (current.has(teamId)) {
      current.delete(teamId);
    } else {
      if (conf === "east" && eastSelectedCount >= 8) return;
      if (conf === "west" && westSelectedCount >= 8) return;
      current.add(teamId);
    }
    setFormPicks({ ...formPicks, playoffTeams: Array.from(current) });
  };

  const handleSavePicks = () => {
    if (!viewerTeam) {
      setMsg({ type: "error", text: "Sign in as a team GM to submit picks." });
      return;
    }
    if (!window.confirm("Do you really want to submit your picks for good?\n\nWARNING: Each GM can pick only once and after submitting NO PICKS CAN BE EDITED OR CHANGED!")) {
      return;
    }
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await saveSeasonPicksAction(formPicks, config.season, config.league);
        if (res.ok) {
          try {
            if (typeof window !== "undefined" && viewerTeam?.id) {
              localStorage.removeItem(`unhl_season_picks_draft_${viewerTeam.id}`);
            }
          } catch {}
          setMsg({ type: "success", text: "✅ Your pre-season ticket was submitted successfully and for good! Picks can no longer be changed." });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setMsg({ type: "error", text: res.error || "Error saving picks." });
        }
      } catch (err: any) {
        console.error("Save season picks error:", err);
        alert("The app was updated to a new version on the server. Your filled-in draft of picks is safely saved. The page will now reload — please then click Submit picks.");
        window.location.reload();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                TOOLS & PREDICTIONS
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  config.status === "OPEN"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {config.status === "OPEN" ? "🟢 OPEN FOR PICKS" : "🔒 LOCKED"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>🎯 Picks League & Season Picks</span>
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              The big pre-season picks game for general managers. 10 comprehensive categories, weighted points, NHL trophies and a season-long battle for the king of predictions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {viewerTeam ? (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 backdrop-blur-sm">
                {viewerTeam.logoUrl && (
                  <div className="relative w-8 h-8 flex-shrink-0">
                    <Image src={viewerTeam.logoUrl} alt={viewerTeam.name} fill className="object-contain" />
                  </div>
                )}
                <div>
                  <div className="text-xs text-slate-400 font-medium">Signed-in GM</div>
                  <div className="text-sm font-bold text-white leading-tight">
                    {viewerTeam.gmNickname || viewerTeam.gm || viewerTeam.name}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
                ⚠️ Sign in as a team GM to submit picks.
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setTab("picks")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === "picks"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-slate-800/60 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <span>📝 {isEn ? "Season Picks (My Ticket)" : "Sezónne tipy (Môj tiket)"}</span>
          </button>
          <button
            onClick={() => setTab("leaderboard")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === "leaderboard"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-slate-800/60 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <span>🏆 {isEn ? "GM Leaderboard" : "Tabuľka GM"} ({submissions.length})</span>
          </button>
          <button
            onClick={() => setTab("daily")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === "daily"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-slate-800/60 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <span>📅 {isEn ? "Game Picks (Daily)" : "Denné tipy (Game Picks)"}</span>
          </button>
          <button
            onClick={() => setTab("rules")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === "rules"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-slate-800/60 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <span>📖 {isEn ? "Rules & Rewards" : "Pravidlá a odmeny"}</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setTab("admin")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                tab === "admin"
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30"
                  : "bg-slate-800/60 hover:bg-slate-800 text-amber-300 border border-amber-500/20"
              }`}
            >
              <span>⚙️ {isEn ? "Admin & Evaluation" : "Admin a vyhodnotenie"}</span>
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            msg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="text-xs underline hover:opacity-80">
            Close
          </button>
        </div>
      )}

      {/* TAB 1: SEASON PICKS FORM */}
      {tab === "picks" && (
        <div className="space-y-8">
          {/* Status Alert */}
          {hasSubmitted && !isAdmin ? (
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-sm flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">🔒</span>
              <div>
                <strong className="font-bold text-white text-base block mb-0.5">Your pre-season ticket has been submitted</strong>
                <p className="text-xs text-indigo-200/90 leading-relaxed">
                  Each GM can pick only <strong>once</strong> under their login. Picks <strong>can no longer be edited or changed</strong>. Below you can review your submitted choices.
                </p>
              </div>
            </div>
          ) : config.isLocked && !isAdmin ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">⏰</span>
              <div>
                <strong className="font-bold text-white text-base block mb-0.5">The picks game is locked after the deadline</strong>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  The deadline for submitting pre-season picks has passed. New tickets can no longer be submitted.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">⚠️</span>
                <div>
                  <strong className="font-bold text-amber-300 text-sm block">IMPORTANT NOTICE: Each GM can pick only once!</strong>
                  <p className="text-xs text-amber-200/90 mt-0.5 leading-relaxed">
                    After the form is submitted for good, <strong>PICKS CAN NO LONGER BE CHANGED</strong>. Before submitting, please carefully check all your choices in all 10 sections.
                  </p>
                </div>
              </div>
              {viewerTeam && (
                <button
                  onClick={handleSavePicks}
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-center"
                >
                  {isPending ? "Submitting..." : "🚀 Submit ticket for good"}
                </button>
              )}
            </div>
          )}

          {/* SECTION 1: STANLEY CUP */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🏆</span>
                <div>
                  <h2 className="text-lg font-bold text-white">1. Stanley Cup (Max 70 pts)</h2>
                  <p className="text-xs text-slate-400">Overall winner, losing finalist and the exact series result.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                Winner: 30 pts | Finalist: 15 pts | Pair: +15 pts | Series: 10 pts
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🥇 Stanley Cup Winner (30 pts)
                </label>
                <select
                  disabled={isLocked}
                  value={formPicks.stanleyCup?.winnerTeamId || ""}
                  onChange={(e) =>
                    setFormPicks({
                      ...formPicks,
                      stanleyCup: {
                        ...formPicks.stanleyCup,
                        winnerTeamId: Number(e.target.value) || undefined,
                      },
                    })
                  }
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select a team --</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🥈 Losing finalist (15 pts)
                </label>
                <select
                  disabled={isLocked}
                  value={formPicks.stanleyCup?.finalistTeamId || ""}
                  onChange={(e) =>
                    setFormPicks({
                      ...formPicks,
                      stanleyCup: {
                        ...formPicks.stanleyCup,
                        finalistTeamId: Number(e.target.value) || undefined,
                      },
                    })
                  }
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select a team --</option>
                  {teams
                    .filter((t: any) => t.id !== formPicks.stanleyCup?.winnerTeamId)
                    .map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🎯 Final series result (10 pts)
                </label>
                <select
                  disabled={isLocked}
                  value={formPicks.stanleyCup?.seriesScore || "4:2"}
                  onChange={(e) =>
                    setFormPicks({
                      ...formPicks,
                      stanleyCup: {
                        ...formPicks.stanleyCup,
                        seriesScore: e.target.value as any,
                      },
                    })
                  }
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="4:0">4:0</option>
                  <option value="4:1">4:1</option>
                  <option value="4:2">4:2</option>
                  <option value="4:3">4:3</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: DIVISION WINNERS */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🥇</span>
                <div>
                  <h2 className="text-lg font-bold text-white">2. Division winners (Max 55 pts)</h2>
                  <p className="text-xs text-slate-400">Pick the winner of each of the 4 NHL divisions.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                10 pts per division | 4/4 bonus: +15 pts
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Atlantic */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
                  Atlantic Division
                </div>
                <select
                  disabled={isLocked}
                  value={formPicks.divisionWinners?.atlanticTeamId || ""}
                  onChange={(e) =>
                    setFormPicks({
                      ...formPicks,
                      divisionWinners: {
                        ...formPicks.divisionWinners,
                        atlanticTeamId: Number(e.target.value) || undefined,
                      },
                    })
                  }
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select a team --</option>
                  {atlanticTeams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Metro */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
                  Metropolitan Division
                </div>
                <select
                  disabled={isLocked}
                  value={formPicks.divisionWinners?.metroTeamId || ""}
                  onChange={(e) =>
                    setFormPicks({
                      ...formPicks,
                      divisionWinners: {
                        ...formPicks.divisionWinners,
                        metroTeamId: Number(e.target.value) || undefined,
                      },
                    })
                  }
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select a team --</option>
                  {metroTeams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Central */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
                  Central Division
                </div>
                <select
                  disabled={isLocked}
                  value={formPicks.divisionWinners?.centralTeamId || ""}
                  onChange={(e) =>
                    setFormPicks({
                      ...formPicks,
                      divisionWinners: {
                        ...formPicks.divisionWinners,
                        centralTeamId: Number(e.target.value) || undefined,
                      },
                    })
                  }
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select a team --</option>
                  {centralTeams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pacific */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
                  Pacific Division
                </div>
                <select
                  disabled={isLocked}
                  value={formPicks.divisionWinners?.pacificTeamId || ""}
                  onChange={(e) =>
                    setFormPicks({
                      ...formPicks,
                      divisionWinners: {
                        ...formPicks.divisionWinners,
                        pacificTeamId: Number(e.target.value) || undefined,
                      },
                    })
                  }
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select a team --</option>
                  {pacificTeams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: PRESIDENTS' TROPHY */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h2 className="text-lg font-bold text-white">3. Presidents' Trophy (Max 25 pts)</h2>
                  <p className="text-xs text-slate-400">Regular-season winner and a prediction of his point total.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                Team: 15 pts | Points: Exact 10 pts / ±2: 7 pts / ±5: 4 pts
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Team with the most points in the regular season (15 pts)
                </label>
                <select
                  disabled={isLocked}
                  value={formPicks.presidentsTrophy?.teamId || ""}
                  onChange={(e) =>
                    setFormPicks({
                      ...formPicks,
                      presidentsTrophy: {
                        ...formPicks.presidentsTrophy,
                        teamId: Number(e.target.value) || undefined,
                      },
                    })
                  }
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select a team --</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Prediction of the RS winner's point total (e.g. 116 pts)
                </label>
                <input
                  type="number"
                  disabled={isLocked}
                  min={80}
                  max={145}
                  value={formPicks.presidentsTrophy?.points || ""}
                  onChange={(e) =>
                    setFormPicks({
                      ...formPicks,
                      presidentsTrophy: {
                        ...formPicks.presidentsTrophy,
                        points: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="napr. 116"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: PLAYOFF TEAMS (16 TEAMS) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🎟️</span>
                <div>
                  <h2 className="text-lg font-bold text-white">4. Playoff Teams (Max 52 pts)</h2>
                  <p className="text-xs text-slate-400">
                    Select the 16 teams that advance (8 East + 8 West).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                2 pts per team | 8/8 bonus per conference: +10 pts
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Eastern Conference */}
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-blue-400">EASTERN CONFERENCE</div>
                  <div
                    className={`text-xs font-mono px-2.5 py-0.5 rounded-full ${
                      eastSelectedCount === 8
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    Selected: {eastSelectedCount} / 8
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {eastTeams.map((t: any) => {
                    const isSel = selectedPlayoffs.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => togglePlayoffTeam(t.id, "east")}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                          isSel
                            ? "bg-blue-600/20 border-blue-500 text-white font-semibold shadow-sm"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {t.logoUrl && (
                          <div className="relative w-6 h-6 flex-shrink-0">
                            <Image src={t.logoUrl} alt={t.name} fill className="object-contain" />
                          </div>
                        )}
                        <span className="text-xs truncate">{t.code || t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Western Conference */}
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-rose-400">WESTERN CONFERENCE</div>
                  <div
                    className={`text-xs font-mono px-2.5 py-0.5 rounded-full ${
                      westSelectedCount === 8
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    Selected: {westSelectedCount} / 8
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {westTeams.map((t: any) => {
                    const isSel = selectedPlayoffs.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => togglePlayoffTeam(t.id, "west")}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                          isSel
                            ? "bg-rose-600/20 border-rose-500 text-white font-semibold shadow-sm"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {t.logoUrl && (
                          <div className="relative w-6 h-6 flex-shrink-0">
                            <Image src={t.logoUrl} alt={t.name} fill className="object-contain" />
                          </div>
                        )}
                        <span className="text-xs truncate">{t.code || t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: STAT LEADERS */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📊</span>
                <div>
                  <h2 className="text-lg font-bold text-white">5. NHL Scoring & Statistics (Max 60 pts)</h2>
                  <p className="text-xs text-slate-400">Top scorers and leaders in individual stats, with search.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                Art Ross: 15 pts | Richard: 15 pts | Assists: 10 pts | Defenseman: 10 pts | Rookie: 10 pts
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Art Ross */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🥇 Art Ross Trophy — Most points (15 pts)
                </label>
                <SearchablePlayerSelect
                  disabled={isLocked}
                  value={formPicks.statLeaders?.artRossPlayerId}
                  players={players}
                  teams={teams}
                  placeholder="-- Search Art Ross winner --"
                  onChange={(pid) =>
                    setFormPicks({
                      ...formPicks,
                      statLeaders: {
                        ...formPicks.statLeaders,
                        artRossPlayerId: pid,
                      },
                    })
                  }
                />
              </div>

              {/* Maurice Richard */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🎯 Maurice Richard — Top goal scorer (15 pts)
                </label>
                <SearchablePlayerSelect
                  disabled={isLocked}
                  value={formPicks.statLeaders?.rocketRichardPlayerId}
                  players={players}
                  teams={teams}
                  placeholder="-- Search top goal scorer --"
                  onChange={(pid) =>
                    setFormPicks({
                      ...formPicks,
                      statLeaders: {
                        ...formPicks.statLeaders,
                        rocketRichardPlayerId: pid,
                      },
                    })
                  }
                />
              </div>

              {/* Assists */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🅰️ Most assists (10 pts)
                </label>
                <SearchablePlayerSelect
                  disabled={isLocked}
                  value={formPicks.statLeaders?.assistsPlayerId}
                  players={players}
                  teams={teams}
                  placeholder="-- Search assists leader --"
                  onChange={(pid) =>
                    setFormPicks({
                      ...formPicks,
                      statLeaders: {
                        ...formPicks.statLeaders,
                        assistsPlayerId: pid,
                      },
                    })
                  }
                />
              </div>

              {/* Top D-man */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🛡️ Top-scoring defenseman (10 pts)
                </label>
                <SearchablePlayerSelect
                  disabled={isLocked}
                  value={formPicks.statLeaders?.topDmanPlayerId}
                  players={players}
                  teams={teams}
                  placeholder="-- Search top defenseman --"
                  filter={(p) => p.position?.includes("D")}
                  onChange={(pid) =>
                    setFormPicks({
                      ...formPicks,
                      statLeaders: {
                        ...formPicks.statLeaders,
                        topDmanPlayerId: pid,
                      },
                    })
                  }
                />
              </div>

              {/* Top Rookie */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🌟 Top-scoring rookie (10 pts)
                </label>
                <SearchablePlayerSelect
                  disabled={isLocked}
                  value={formPicks.statLeaders?.topRookiePlayerId}
                  players={players}
                  teams={teams}
                  placeholder="-- Search top rookie --"
                  onChange={(pid) =>
                    setFormPicks({
                      ...formPicks,
                      statLeaders: {
                        ...formPicks.statLeaders,
                        topRookiePlayerId: pid,
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* SECTION 6: TROPHIES */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🎖️</span>
                <div>
                  <h2 className="text-lg font-bold text-white">6. NHL Trophies (10 pts per trophy, Max 60 pts)</h2>
                  <p className="text-xs text-slate-400">
                    Choose your favorite to win each of the 6 prestigious NHL trophies. You earn 10 points for every correct pick.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TROPHIES_LIST.map((tDef) => {
                const current = trophyPicks.find((tp) => tp.key === tDef.key) || {
                  key: tDef.key,
                  name: tDef.name,
                };

                return (
                  <div key={tDef.key} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div>
                      <div className="font-bold text-sm text-white">{tDef.name}</div>
                      <div className="text-xs text-slate-400">{tDef.desc}</div>
                    </div>

                    <div>
                      {tDef.key === "JackAdams" ? (
                        <select
                          disabled={isLocked}
                          value={current.teamId || ""}
                          onChange={(e) => {
                            const tid = Number(e.target.value) || undefined;
                            const tObj = teams.find((t: any) => t.id === tid);
                            const updated = trophyPicks.filter((tp) => tp.key !== tDef.key);
                            updated.push({
                              ...current,
                              teamId: tid,
                              teamName: tObj?.name,
                              playerName: tObj?.coach || tObj?.name,
                            });
                            setFormPicks({ ...formPicks, trophies: updated });
                          }}
                          className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">-- Select a team / coach --</option>
                          {teams.map((t: any) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <SearchablePlayerSelect
                          disabled={isLocked}
                          value={current.playerId}
                          players={players}
                          teams={teams}
                          placeholder={`-- Search ${tDef.name.split(" ")[0]} winner --`}
                          filter={(p) => {
                            if (tDef.key === "Norris") return p.position?.includes("D");
                            if (tDef.key === "Vezina") return p.isGoalie;
                            return true;
                          }}
                          onChange={(pid, pObj) => {
                            const updated = trophyPicks.filter((tp) => tp.key !== tDef.key);
                            updated.push({
                              ...current,
                              playerId: pid,
                              playerName: pObj?.name,
                            });
                            setFormPicks({ ...formPicks, trophies: updated });
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 7: OVER / UNDER */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📈</span>
                <div>
                  <h2 className="text-lg font-bold text-white">7. Over / Under (4 pts per correct pick)</h2>
                  <p className="text-xs text-slate-400">Will the selected players and teams beat the set point line?</p>
                </div>
              </div>
              <div className="text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                4 pts per correct pick
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ouQuestions.map((q) => {
                const currentVal = formPicks.overUnder?.[String(q.id)];
                return (
                  <div key={q.id} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-200">{q.text}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setFormPicks({
                            ...formPicks,
                            overUnder: {
                              ...formPicks.overUnder,
                              [String(q.id)]: "OVER",
                            },
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          currentVal === "OVER"
                            ? "bg-emerald-600 text-white shadow"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        OVER ▲
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setFormPicks({
                            ...formPicks,
                            overUnder: {
                              ...formPicks.overUnder,
                              [String(q.id)]: "UNDER",
                            },
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          currentVal === "UNDER"
                            ? "bg-rose-600 text-white shadow"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        UNDER ▼
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 8: HEAD TO HEAD DUELS */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚔️</span>
                <div>
                  <h2 className="text-lg font-bold text-white">8. Head-to-Head Duels (3 pts per correct pick)</h2>
                  <p className="text-xs text-slate-400">Who will earn more points in a direct micro-duel?</p>
                </div>
              </div>
              <div className="text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                3 pts per correct duel
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {h2hDuels.map((d) => {
                const currentVal = formPicks.h2h?.[String(d.id)];
                return (
                  <div key={d.id} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-indigo-400 font-semibold">{d.metric}</div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {d.playerA} <span className="text-slate-500 font-normal">vs</span> {d.playerB}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setFormPicks({
                            ...formPicks,
                            h2h: { ...formPicks.h2h, [String(d.id)]: "A" },
                          })
                        }
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          currentVal === "A"
                            ? "bg-indigo-600 text-white shadow"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {d.playerA}
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setFormPicks({
                            ...formPicks,
                            h2h: { ...formPicks.h2h, [String(d.id)]: "B" },
                          })
                        }
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          currentVal === "B"
                            ? "bg-indigo-600 text-white shadow"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {d.playerB}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 9: BOLD PREDICTIONS */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚡</span>
                <div>
                  <h2 className="text-lg font-bold text-white">9. Bold Predictions (4 pts per correct pick)</h2>
                  <p className="text-xs text-slate-400">Bold pre-season statements: Yes or No?</p>
                </div>
              </div>
              <div className="text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                4 pts per correct statement
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {boldStatements.map((b) => {
                const currentVal = formPicks.bold?.[String(b.id)];
                return (
                  <div key={b.id} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-200">{b.text}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setFormPicks({
                            ...formPicks,
                            bold: { ...formPicks.bold, [String(b.id)]: "YES" },
                          })
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          currentVal === "YES"
                            ? "bg-emerald-600 text-white shadow"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        YES ✓
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setFormPicks({
                            ...formPicks,
                            bold: { ...formPicks.bold, [String(b.id)]: "NO" },
                          })
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          currentVal === "NO"
                            ? "bg-rose-600 text-white shadow"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        NO ✗
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 10: WILDCARD (SLEEPER & BUST) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🌟</span>
                <div>
                  <h2 className="text-lg font-bold text-white">10. Wildcard: Sleeper & Bust teams (Max 30 pts)</h2>
                  <p className="text-xs text-slate-400">
                    Sleeper (the surprise of the season) and Bust (an expected disappointment among top teams).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                Sleeper: PO (+10 pts) / Division (+20 pts) | Bust: Out of PO (+10 pts)
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                  <span>🚀 Sleeper Team (Riser of the season)</span>
                </div>
                <div className="text-xs text-slate-400">
                  A team you expect a much better season from. Making the PO = +10 pts, winning the division = +20 pts.
                </div>
                <select
                  disabled={isLocked}
                  value={formPicks.wildcard?.sleeperTeamId || ""}
                  onChange={(e) =>
                    setFormPicks({
                      ...formPicks,
                      wildcard: {
                        ...formPicks.wildcard,
                        sleeperTeamId: Number(e.target.value) || undefined,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 mt-2"
                >
                  <option value="">-- Select a team --</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-sm text-rose-400 flex items-center gap-2">
                  <span>📉 Bust Team (Disappointment of the season)</span>
                </div>
                <div className="text-xs text-slate-400">
                  A top team from last season (90+ points) that misses the playoffs (+10 pts).
                </div>
                <select
                  disabled={isLocked}
                  value={formPicks.wildcard?.bustTeamId || ""}
                  onChange={(e) =>
                    setFormPicks({
                      ...formPicks,
                      wildcard: {
                        ...formPicks.wildcard,
                        bustTeamId: Number(e.target.value) || undefined,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 mt-2"
                >
                  <option value="">-- Select a team (only 90+ pts last season) --</option>
                  {bustEligibleTeams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Bottom Save Action */}
          {!isLocked && viewerTeam && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-amber-300 flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <span>Notice: After submitting, picks can no longer be changed. You can submit the form only once.</span>
              </div>
              <button
                onClick={handleSavePicks}
                disabled={isPending}
                className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-xl shadow-emerald-600/30 transition-all disabled:opacity-50 flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                {isPending ? "Submitting..." : "🚀 Submit ticket for good (cannot be changed)"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LEADERBOARD */}
      {tab === "leaderboard" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🏆 Standings & Leaderboard of the Picks League</span>
              </h2>
              <p className="text-xs text-slate-400">
                Official ranking of general managers in the season-long picks game.
              </p>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Total tickets submitted: {submissions.length}
            </div>
          </div>

          {/* REWARDS SUMMARY CARDS */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/20 via-slate-950 to-indigo-950/30 border border-amber-500/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <span>🎁 Season-long rewards for the TOP 3 predictors:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/30">
                <span className="font-bold text-amber-300">🥇 1. miesto:</span>{" "}
                <strong className="text-white">+$3,000,000</strong> + 🎟️ <strong>Round 8 draft pick</strong> + Gold badge
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700">
                <span className="font-bold text-slate-300">🥈 2. miesto:</span>{" "}
                <strong className="text-white">+$1,500,000</strong> + 🎟️ <strong>Round 8 draft pick</strong> + Silver badge
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-700/30">
                <span className="font-bold text-amber-400">🥉 3. miesto:</span>{" "}
                <strong className="text-white">+$750,000</strong> + 🎟️ <strong>Round 8 draft pick</strong> + Bronze badge
              </div>
            </div>
            <div className="text-[10px] text-slate-400">
              * Všetky bonusové draft picky (celoročná TOP 3 aj mesační šampióni Game Picks) sa zapisujú do 8. kola draftu (ak je 32 pozícií plných, automaticky do 9. kola).
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No picks have been submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Team / GM</th>
                    <th className="py-3 px-3 text-center">SC</th>
                    <th className="py-3 px-3 text-center">Divisions</th>
                    <th className="py-3 px-3 text-center">Presidents</th>
                    <th className="py-3 px-3 text-center">Playoff</th>
                    <th className="py-3 px-3 text-center">Leaders</th>
                    <th className="py-3 px-3 text-center">Trofeje</th>
                    <th className="py-3 px-3 text-center">O/U</th>
                    <th className="py-3 px-3 text-center">H2H</th>
                    <th className="py-3 px-3 text-center">Bold</th>
                    <th className="py-3 px-3 text-center">Wildcard</th>
                    <th className="py-3 px-3 text-right font-bold text-white">SPOLU</th>
                    <th className="py-3 px-3 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {submissions.map((sub: any, idx: number) => {
                    const b: SectionPointsBreakdown = sub.pointsBreakdown;
                    const isMy = viewerTeam?.id === sub.teamId;

                    return (
                      <tr
                        key={sub.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isMy ? "bg-indigo-950/30 border-l-4 border-indigo-500" : ""
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-400">{idx + 1}.</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            {sub.team?.logoUrl && (
                              <div className="relative w-6 h-6 flex-shrink-0">
                                <Image src={sub.team.logoUrl} alt={sub.team.name} fill className="object-contain" />
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-white leading-tight">
                                {sub.submittedBy || sub.team?.gmNickname || sub.team?.name}
                              </div>
                              <div className="text-[11px] text-slate-400">{sub.team?.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{b?.stanleyCup?.points ?? "—"}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{b?.divisionWinners?.points ?? "—"}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{b?.presidentsTrophy?.points ?? "—"}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{b?.playoffTeams?.points ?? "—"}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{b?.statLeaders?.points ?? "—"}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{b?.trophies?.points ?? "—"}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{b?.overUnder?.points ?? "—"}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{b?.h2h?.points ?? "—"}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{b?.bold?.points ?? "—"}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">{b?.wildcard?.points ?? "—"}</td>
                        <td className="py-3 px-3 text-right font-mono font-black text-indigo-300 text-base">
                          {sub.totalPoints} b
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedSubmission(sub)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition-all"
                          >
                            👁️ Ticket
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Submission Modal */}
          {selectedSubmission && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    {selectedSubmission.team?.logoUrl && (
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <Image src={selectedSubmission.team.logoUrl} alt={selectedSubmission.team.name} fill className="object-contain" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        GM Ticket: {selectedSubmission.submittedBy || selectedSubmission.team?.name}
                      </h3>
                      <div className="text-xs text-slate-400">
                        Total points: <strong className="text-indigo-400 font-mono">{selectedSubmission.totalPoints} pts</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSubmission(null)}
                    className="text-slate-400 hover:text-white text-xl font-bold px-2 py-1"
                  >
                    ✕
                  </button>
                </div>

                {!selectedSubmission.picks ? (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    🔒 This GM's picks are hidden until the deadline.
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    {/* SC */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="font-bold text-slate-300 mb-1">1. Stanley Cup:</div>
                      <div className="text-slate-400">
                        Winner: <strong className="text-white">{teams.find((t: any) => t.id === selectedSubmission.picks.stanleyCup?.winnerTeamId)?.name || "—"}</strong> | Finalist: <strong className="text-white">{teams.find((t: any) => t.id === selectedSubmission.picks.stanleyCup?.finalistTeamId)?.name || "—"}</strong> | Series: <strong className="text-white font-mono">{selectedSubmission.picks.stanleyCup?.seriesScore || "—"}</strong>
                      </div>
                    </div>

                    {/* Divs */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="font-bold text-slate-300 mb-1">2. Division winners:</div>
                      <div className="grid grid-cols-2 gap-2 text-slate-400">
                        <div>ATL: <strong className="text-white">{teams.find((t: any) => t.id === selectedSubmission.picks.divisionWinners?.atlanticTeamId)?.name || "—"}</strong></div>
                        <div>MET: <strong className="text-white">{teams.find((t: any) => t.id === selectedSubmission.picks.divisionWinners?.metroTeamId)?.name || "—"}</strong></div>
                        <div>CEN: <strong className="text-white">{teams.find((t: any) => t.id === selectedSubmission.picks.divisionWinners?.centralTeamId)?.name || "—"}</strong></div>
                        <div>PAC: <strong className="text-white">{teams.find((t: any) => t.id === selectedSubmission.picks.divisionWinners?.pacificTeamId)?.name || "—"}</strong></div>
                      </div>
                    </div>

                    {/* Presidents */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="font-bold text-slate-300 mb-1">3. Presidents' Trophy:</div>
                      <div className="text-slate-400">
                        Team: <strong className="text-white">{teams.find((t: any) => t.id === selectedSubmission.picks.presidentsTrophy?.teamId)?.name || "—"}</strong> ({selectedSubmission.picks.presidentsTrophy?.points} pts)
                      </div>
                    </div>

                    {/* Playoff Teams */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="font-bold text-slate-300 mb-1">4. Playoff teams ({selectedSubmission.picks.playoffTeams?.length || 0}/16):</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(selectedSubmission.picks.playoffTeams || []).map((tid: number) => {
                          const tObj = teams.find((t: any) => t.id === tid);
                          return (
                            <span key={tid} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                              {tObj?.code || tObj?.name || tid}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Stat Leaders */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="font-bold text-slate-300 mb-1">5. Statistical leaders:</div>
                      <div className="grid grid-cols-2 gap-2 text-slate-400">
                        <div>Art Ross: <strong className="text-white">{players.find((p: any) => p.id === selectedSubmission.picks.statLeaders?.artRossPlayerId)?.name || "—"}</strong></div>
                        <div>Richard: <strong className="text-white">{players.find((p: any) => p.id === selectedSubmission.picks.statLeaders?.rocketRichardPlayerId)?.name || "—"}</strong></div>
                        <div>Assists: <strong className="text-white">{players.find((p: any) => p.id === selectedSubmission.picks.statLeaders?.assistsPlayerId)?.name || "—"}</strong></div>
                        <div>Top Defenseman: <strong className="text-white">{players.find((p: any) => p.id === selectedSubmission.picks.statLeaders?.topDmanPlayerId)?.name || "—"}</strong></div>
                        <div>Top Rookie: <strong className="text-white">{players.find((p: any) => p.id === selectedSubmission.picks.statLeaders?.topRookiePlayerId)?.name || "—"}</strong></div>
                      </div>
                    </div>

                    {/* Trophies */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="font-bold text-slate-300 mb-1">6. Trophies:</div>
                      <div className="grid grid-cols-2 gap-2 text-slate-400">
                        {(selectedSubmission.picks.trophies || []).map((t: any) => (
                          <div key={t.key}>
                            {t.key}: <strong className="text-white">{t.playerName || t.teamName || "—"}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Wildcard */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="font-bold text-slate-300 mb-1">10. Wildcard:</div>
                      <div className="text-slate-400">
                        Sleeper: <strong className="text-emerald-400">{teams.find((t: any) => t.id === selectedSubmission.picks.wildcard?.sleeperTeamId)?.name || "—"}</strong> | Bust: <strong className="text-rose-400">{teams.find((t: any) => t.id === selectedSubmission.picks.wildcard?.bustTeamId)?.name || "—"}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DAILY PICKS (GAME PICKS) */}
      {tab === "daily" && (
        <GamePicksView
          data={initialData.gamePicksData || {}}
          viewerTeam={viewerTeam}
          isAdmin={isAdmin}
        />
      )}

      {/* TAB: RULES & REWARDS */}
      {tab === "rules" && (
        <div className="space-y-6">
          {/* REWARDS HERO CARD */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-indigo-950/50 border border-amber-500/30 space-y-6 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎁</span>
                <div>
                  <h2 className="text-xl font-black text-white">Official Rewards for UNHL Picks League Winners</h2>
                  <p className="text-xs text-slate-300">
                    Financial grants to the club bank account, bonus Entry Draft picks and prestigious profile badges.
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <span>🏆 Season 2026/27</span>
              </div>
            </div>

            {/* TOP 3 CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1st */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-amber-500/40 space-y-3 relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🥇 1. Miesto</span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    Overall Champion
                  </span>
                </div>
                <div className="text-2xl font-black text-amber-300">+$3,000,000</div>
                <ul className="text-slate-300 space-y-1.5 text-xs">
                  <li className="flex items-center gap-2">
                    <span>🎟️</span>
                    <span><strong>Round 8 Draft Pick</strong> (or Round 9)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>🥇</span>
                    <span>Gold badge <strong>Season Predictor Champion</strong></span>
                  </li>
                </ul>
              </div>

              {/* 2nd */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-700 space-y-3 relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🥈 2. Miesto</span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-500/20 text-slate-300 font-bold border border-slate-600">
                    Vicemajster
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-200">+$1,500,000</div>
                <ul className="text-slate-300 space-y-1.5 text-xs">
                  <li className="flex items-center gap-2">
                    <span>🎟️</span>
                    <span><strong>Round 8 Draft Pick</strong> (or Round 9)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>🥈</span>
                    <span>Silver badge <strong>Vice-Champion</strong></span>
                  </li>
                </ul>
              </div>

              {/* 3rd */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-amber-700/40 space-y-3 relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🥉 3. Miesto</span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-700/20 text-amber-400 font-bold border border-amber-700/40">
                    3. Miesto
                  </span>
                </div>
                <div className="text-2xl font-black text-amber-400">+$750,000</div>
                <ul className="text-slate-300 space-y-1.5 text-xs">
                  <li className="flex items-center gap-2">
                    <span>🎟️</span>
                    <span><strong>Round 8 Draft Pick</strong> (or Round 9)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>🥉</span>
                    <span>Bronze badge <strong>3rd Place</strong></span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Weekly & Monthly info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-emerald-500/30 space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                  <span>📅 Weekly Picks (Game Picks)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Every winner of a given game week in game picks earns a financial reward of <strong className="text-emerald-300">+$200,000</strong> for the club bank account.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-amber-500/30 space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                  <span>🏆 Monthly Champions (Oct–Apr)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The best predictor of the month gets a 🎟️ <strong>Bonus Round 8 Draft Pick</strong> (or Round 9), <strong>+10 bonus points</strong> and a badge on the profile.
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-400 bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
              <span className="text-lg">ℹ️</span>
              <div>
                <strong className="text-slate-200">Draft pick allocation rule:</strong> All bonus draft picks earned in the picks game (the season TOP 3 and the monthly champions) are generated in <strong>Round 8</strong> of the entry draft. If all 32 positions in Round 8 are filled, the pick is automatically recorded in <strong>Round 9</strong>.
              </div>
            </div>
          </div>

          {/* SCORING BREAKDOWN: SEASON PICKS (10 SECTIONS) */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📋 Scoring System of the Season Picks game</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Overview of all 10 ticket categories, point values and bonuses (up to ~418 points in total).
                </p>
              </div>
              <div className="px-3 py-1 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-xs font-mono text-indigo-300 font-bold">
                10 Categories · Max ~418 points
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* 1. SC */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="text-indigo-400 font-mono">1.</span>
                  <span>🏆 Stanley Cup</span>
                  <span className="text-amber-400 font-mono">Max 50 pts</span>
                </div>
                <p className="text-slate-400">
                  Cup winner (25 pts), Finalist (15 pts), Exact final series result (10 pts).
                </p>
              </div>

              {/* 2. Divisions */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="text-indigo-400 font-mono">2.</span>
                  <span>🥇 Division Winners</span>
                  <span className="text-amber-400 font-mono">Max 55 pts</span>
                </div>
                <p className="text-slate-400">
                  10 pts per correct division (Atlantic, Metro, Central, Pacific) + a 15 pts bonus for getting all 4/4.
                </p>
              </div>

              {/* 3. Presidents */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="text-indigo-400 font-mono">3.</span>
                  <span>🛡️ Presidents' Trophy</span>
                  <span className="text-amber-400 font-mono">Max 25 pts</span>
                </div>
                <p className="text-slate-400">
                  Regular-season winner (15 pts) + an exact team point estimate within ±3 points (10 pts).
                </p>
              </div>

              {/* 4. Playoff teams */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="text-indigo-400 font-mono">4.</span>
                  <span>🎟️ 16 Advancing Teams</span>
                  <span className="text-amber-400 font-mono">Max 63 pts</span>
                </div>
                <p className="text-slate-400">
                  3 pts per correctly selected team advancing to the playoffs + a 15 pts bonus for getting all 16/16.
                </p>
              </div>

              {/* 5. Stat leaders */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="text-indigo-400 font-mono">5.</span>
                  <span>🎯 Statistical Leaders</span>
                  <span className="text-amber-400 font-mono">Max 50 pts</span>
                </div>
                <p className="text-slate-400">
                  Art Ross (10 pts), Rocket Richard (10 pts), Most assists (10 pts), Top-scoring defenseman (10 pts), Top-scoring rookie (10 pts).
                </p>
              </div>

              {/* 6. Trophies */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="text-indigo-400 font-mono">6.</span>
                  <span>🎖️ NHL Trofeje</span>
                  <span className="text-amber-400 font-mono">Max 70 pts</span>
                </div>
                <p className="text-slate-400">
                  Hart, Norris, Vezina, Calder, Selke, Conn Smythe and Jack Adams Trophy – 10 points for every correctly picked trophy.
                </p>
              </div>

              {/* 7. O/U */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="text-indigo-400 font-mono">7.</span>
                  <span>📊 Over / Under Team Points</span>
                  <span className="text-amber-400 font-mono">Max 55 pts</span>
                </div>
                <p className="text-slate-400">
                  5 pts per correct Over/Under pick on team points in the regular season + a 15 pts bonus for 8/8.
                </p>
              </div>

              {/* 8. H2H */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="text-indigo-400 font-mono">8.</span>
                  <span>⚔️ Head-to-Head Duely</span>
                  <span className="text-amber-400 font-mono">Max 40 pts</span>
                </div>
                <p className="text-slate-400">
                  6 pts per correct team duel for a better place in the standings + a 10 pts bonus for 5/5.
                </p>
              </div>

              {/* 9. Bold */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="text-indigo-400 font-mono">9.</span>
                  <span>⚡ Bold Predikcie</span>
                  <span className="text-amber-400 font-mono">Max 30 pts</span>
                </div>
                <p className="text-slate-400">
                  10 pts per correct answer to the special league questions.
                </p>
              </div>

              {/* 10. Wildcard */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="text-indigo-400 font-mono">10.</span>
                  <span>🃏 Wildcard (Sleeper & Bust)</span>
                  <span className="text-amber-400 font-mono">Max 20 pts</span>
                </div>
                <p className="text-slate-400">
                  Sleeper team (+10 pts if it makes the PO), Bust team (+10 pts if it misses the PO).
                </p>
              </div>
            </div>
          </div>

          {/* GAME PICKS OVERVIEW CARD */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-emerald-300 flex items-center gap-2">
              <span>📅 Daily Games (Game Picks) & Game of the Week (GOTW)</span>
            </h3>
            <ul className="list-disc list-inside text-slate-300 space-y-1.5 text-xs">
              <li><strong className="text-white">Games of the day:</strong> 2 points for a correct pick of the result after 60 min. (1 - X - 2) or 6 points with an activated Joker.</li>
              <li><strong className="text-white">Game of the Week:</strong> The headline game of the week for up to 15 points (Result 1-X-2 2 pts, Exact score 5 pts, First goal scorer 5 pts, Top-scoring player 3 pts). With a Joker up to 45 points!</li>
              <li><strong className="text-white">Jokers (×3 multiplier):</strong> Each GM has 5 Jokers available per season, which can be used on any game.</li>
              <li><strong className="text-white">Streaks:</strong> 3 correct picks in a row = +2 pts, 5 in a row = +5 pts, 10 in a row = +15 pts.</li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 4: ADMIN CONTROLS */}
      {tab === "admin" && isAdmin && (
        <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                <span>⚙️ Season Picks Administration & Evaluation</span>
              </h2>
              <p className="text-xs text-slate-400">Set the status and deadline and run the points calculation.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Picks game status
              </label>
              <select
                value={config.status}
                onChange={async (e) => {
                  const newSt = e.target.value;
                  const r = await updateSeasonPicksConfigAction({ status: newSt }, config.season, config.league);
                  if (r.ok) setConfig({ ...config, status: newSt });
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="OPEN">🟢 OPEN</option>
                <option value="LOCKED">🔒 LOCKED</option>
                <option value="RESOLVED">🏁 RESOLVED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Deadline for picks
              </label>
              <input
                type="datetime-local"
                value={config.deadline ? new Date(config.deadline).toISOString().slice(0, 16) : ""}
                onChange={async (e) => {
                  const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                  const r = await updateSeasonPicksConfigAction({ deadline: val }, config.season, config.league);
                  if (r.ok) setConfig({ ...config, deadline: val });
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  startTransition(async () => {
                    const res = await evaluateSeasonPicksAction(config.season, config.league);
                    if (res.ok && "count" in res) {
                      setMsg({ type: "success", text: `Successfully recalculated ${res.count} tickets.` });
                    } else if ("error" in res) {
                      setMsg({ type: "error", text: res.error || "Error during evaluation." });
                    }
                  });
                }}
                disabled={isPending}
                className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-600/30 transition-all text-sm disabled:opacity-50"
              >
                {isPending ? "Recalculating..." : "⚡ Run Points Evaluation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
