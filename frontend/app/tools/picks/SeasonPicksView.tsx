"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Image from "next/image";
import {
  saveSeasonPicksAction,
  updateSeasonPicksConfigAction,
  evaluateSeasonPicksAction,
} from "./actions";
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
  placeholder = "-- Vyberte hráča --",
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
              placeholder="🔍 Hľadať hráča podľa mena, tímu..."
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
                Nenašiel sa žiadny hráč pre &quot;{query}&quot;
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
  { key: "Hart", name: "Hart Memorial Trophy", desc: "Najužitočnejší hráč (MVP) základnej časti" },
  { key: "Norris", name: "James Norris Memorial Trophy", desc: "Najlepší obranca" },
  { key: "Vezina", name: "Vezina Trophy", desc: "Najlepší brankár" },
  { key: "Calder", name: "Calder Memorial Trophy", desc: "Nováčik roka (Rookie)" },
  { key: "Selke", name: "Frank J. Selke Trophy", desc: "Najlepšie brániaci útočník" },
  { key: "JackAdams", name: "Jack Adams Award", desc: "Tréner roka" },
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
  const [tab, setTab] = useState<"picks" | "leaderboard" | "daily" | "admin">("picks");
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
    trophies: TROPHIES_LIST.map((t) => ({ key: t.key, name: t.name, confidence: 2 })),
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

  // Confidence usage counter
  const trophyPicks = formPicks.trophies || [];
  const confCounts = {
    1: trophyPicks.filter((t) => t.confidence === 1).length,
    2: trophyPicks.filter((t) => t.confidence === 2).length,
    3: trophyPicks.filter((t) => t.confidence === 3).length,
  };

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
    if (!window.confirm("Naozaj chcete definitívne odoslať svoje tipy?\n\nUPOZORNENIE: Každý GM môže tipovať iba 1-krát a po odoslaní už NEBUDE MOŽNÉ ŽIADNE TIPY UPRAVOVAŤ ANI MENIŤ!")) {
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await saveSeasonPicksAction(formPicks, config.season, config.league);
      if (res.ok) {
        setMsg({ type: "success", text: "Váš predsezónny tiket bol úspešne a definitívne odoslaný! Tipy už nie je možné meniť." });
        window.location.reload();
      } else {
        setMsg({ type: "error", text: res.error || "Chyba pri ukladaní tipov." });
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
                {config.status === "OPEN" ? "🟢 OTVORENÉ PRE TIPY" : "🔒 UZAMKNUTÉ"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>🎯 Tipovacia Liga & Season Picks</span>
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Veľká predsezónna tipovačka pre generálnych manažérov. 10 komplexných kategórií, váhované body, dynamické confidence násobitele a celosezónny súboj o kráľa tipov.
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
                  <div className="text-xs text-slate-400 font-medium">Prihlásený GM</div>
                  <div className="text-sm font-bold text-white leading-tight">
                    {viewerTeam.gmNickname || viewerTeam.gm || viewerTeam.name}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
                ⚠️ Pre odoslanie tipov sa prihláste ako GM tímu.
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
            <span>📝 Season Picks (Môj Tiket)</span>
          </button>
          <button
            onClick={() => setTab("leaderboard")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === "leaderboard"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-slate-800/60 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <span>🏆 Rebríček GM ({submissions.length})</span>
          </button>
          <button
            onClick={() => setTab("daily")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === "daily"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-slate-800/60 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <span>📅 Denná Tipovačka (Zápasy)</span>
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
              <span>⚙️ Správa & Vyhodnotenie</span>
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
            Zavrieť
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
                <strong className="font-bold text-white text-base block mb-0.5">Váš predsezónny tiket bol odoslaný</strong>
                <p className="text-xs text-indigo-200/90 leading-relaxed">
                  Každý GM môže tipovať iba <strong>1-krát</strong> pod svojím prihlásením. Tipy už <strong>nie je možné upravovať ani meniť</strong>. Nižšie si môžete prezrieť svoje odoslané voľby.
                </p>
              </div>
            </div>
          ) : config.isLocked && !isAdmin ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">⏰</span>
              <div>
                <strong className="font-bold text-white text-base block mb-0.5">Tipovačka je po deadline uzamknutá</strong>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  Termín na odosielanie predsezónnych tipov vypršal. Nové tikety už nie je možné odoslať.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">⚠️</span>
                <div>
                  <strong className="font-bold text-amber-300 text-sm block">DÔLEŽITÉ UPOZORNENIE: Každý GM môže tipovať iba 1-krát!</strong>
                  <p className="text-xs text-amber-200/90 mt-0.5 leading-relaxed">
                    Po definitívnom odoslaní formulára už <strong>NIE JE MOŽNÉ TIPY MENIŤ</strong>. Pred odoslaním si prosím dôkladne skontrolujte všetky svoje voľby vo všetkých 10 sekciách.
                  </p>
                </div>
              </div>
              {viewerTeam && (
                <button
                  onClick={handleSavePicks}
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-center"
                >
                  {isPending ? "Odosielam..." : "🚀 Definitívne odoslať tiket"}
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
                  <h2 className="text-lg font-bold text-white">1. Stanley Cup (Max 70 b)</h2>
                  <p className="text-xs text-slate-400">Celkový víťaz, porazený finalista a presný výsledok série.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                Víťaz: 30b | Finalista: 15b | Dvojica: +15b | Séria: 10b
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🥇 Víťaz Stanley Cupu (30 b)
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
                  <option value="">-- Vyberte tím --</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🥈 Porazený finalista (15 b)
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
                  <option value="">-- Vyberte tím --</option>
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
                  🎯 Výsledok série finále (10 b)
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
                  <h2 className="text-lg font-bold text-white">2. Víťazi divízií (Max 55 b)</h2>
                  <p className="text-xs text-slate-400">Tipnite víťaza každej zo 4 divízií NHL.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                10b za každú divíziu | 4/4 bonus: +15b
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
                  <option value="">-- Vyberte tím --</option>
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
                  <option value="">-- Vyberte tím --</option>
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
                  <option value="">-- Vyberte tím --</option>
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
                  <option value="">-- Vyberte tím --</option>
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
                  <h2 className="text-lg font-bold text-white">3. Presidents' Trophy (Max 25 b)</h2>
                  <p className="text-xs text-slate-400">Víťaz základnej časti a tip na jeho bodový zisk.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                Tím: 15b | Body: Presne 10b / ±2b: 7b / ±5b: 4b
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tím s najviac bodmi v základnej časti (15 b)
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
                  <option value="">-- Vyberte tím --</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tip na počet bodov víťaza ZČ (napr. 116 b)
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
                  <h2 className="text-lg font-bold text-white">4. Playoff Teams (Max 52 b)</h2>
                  <p className="text-xs text-slate-400">
                    Označte 16 postupujúcich tímov (8 Východ + 8 Západ).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                2b za tím | Bonus za 8/8 na konferenciu: +10b
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Eastern Conference */}
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-blue-400">VÝCHODNÁ KONFERENCIA</div>
                  <div
                    className={`text-xs font-mono px-2.5 py-0.5 rounded-full ${
                      eastSelectedCount === 8
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    Vybrané: {eastSelectedCount} / 8
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
                  <div className="font-bold text-sm text-rose-400">ZÁPADNÁ KONFERENCIA</div>
                  <div
                    className={`text-xs font-mono px-2.5 py-0.5 rounded-full ${
                      westSelectedCount === 8
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    Vybrané: {westSelectedCount} / 8
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
                  <h2 className="text-lg font-bold text-white">5. Bodovanie & Štatistiky NHL (Max 60 b)</h2>
                  <p className="text-xs text-slate-400">Najproduktívnejší hráči a lídri jednotlivých štatistík s vyhľadávaním.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                Art Ross: 15b | Richard: 15b | Asistencie: 10b | Obranca: 10b | Rookie: 10b
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Art Ross */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🥇 Art Ross Trophy — Najviac bodov (15 b)
                </label>
                <SearchablePlayerSelect
                  disabled={isLocked}
                  value={formPicks.statLeaders?.artRossPlayerId}
                  players={players}
                  teams={teams}
                  placeholder="-- Hľadať Art Ross víťaza --"
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
                  🎯 Maurice Richard — Najlepší strelec (15 b)
                </label>
                <SearchablePlayerSelect
                  disabled={isLocked}
                  value={formPicks.statLeaders?.rocketRichardPlayerId}
                  players={players}
                  teams={teams}
                  placeholder="-- Hľadať najlepšieho strelca --"
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
                  🅰️ Najviac asistencií (10 b)
                </label>
                <SearchablePlayerSelect
                  disabled={isLocked}
                  value={formPicks.statLeaders?.assistsPlayerId}
                  players={players}
                  teams={teams}
                  placeholder="-- Hľadať lídra asistencií --"
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
                  🛡️ Najproduktívnejší obranca (10 b)
                </label>
                <SearchablePlayerSelect
                  disabled={isLocked}
                  value={formPicks.statLeaders?.topDmanPlayerId}
                  players={players}
                  teams={teams}
                  placeholder="-- Hľadať top obrancu --"
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
                  🌟 Najproduktívnejší Rookie (10 b)
                </label>
                <SearchablePlayerSelect
                  disabled={isLocked}
                  value={formPicks.statLeaders?.topRookiePlayerId}
                  players={players}
                  teams={teams}
                  placeholder="-- Hľadať top nováčika --"
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

          {/* SECTION 6: TROPHIES WITH CONFIDENCE 1-3 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🎖️</span>
                <div>
                  <h2 className="text-lg font-bold text-white">6. NHL Trofeje s Confidence 1–3</h2>
                  <p className="text-xs text-slate-400">
                    Priraďte ku každej trofeji mieru dôvery (1 až 3). Zásah = 10 × Confidence, Vedľa = -5 × Confidence.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">Použitie limitov:</span>
                <span className={`px-2 py-0.5 rounded ${confCounts[3] > 2 ? "bg-rose-500/20 text-rose-300 border border-rose-500 font-bold" : "bg-slate-800 text-slate-300"}`}>
                  Conf 3: {confCounts[3]}/2
                </span>
                <span className={`px-2 py-0.5 rounded ${confCounts[2] > 2 ? "bg-rose-500/20 text-rose-300 border border-rose-500 font-bold" : "bg-slate-800 text-slate-300"}`}>
                  Conf 2: {confCounts[2]}/2
                </span>
                <span className={`px-2 py-0.5 rounded ${confCounts[1] > 2 ? "bg-rose-500/20 text-rose-300 border border-rose-500 font-bold" : "bg-slate-800 text-slate-300"}`}>
                  Conf 1: {confCounts[1]}/2
                </span>
              </div>
            </div>

            {/* Confidence Explanatory Card */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/70 border border-indigo-500/30 text-xs space-y-2.5">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                <span>💡 Čo je to Confidence (Dôvera 1–3)?</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Pri každej trofeji určíte svoju mieru dôvery. Vyššia dôvera výrazne násobí body pri správnom tipe, no pri neúspechu sa body odčítajú. Z 6 trofejí musíte confidence vyvážiť — každú úroveň môžete použiť <strong>maximálne 2-krát</strong> (2×3, 2×2, 2×1):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="font-bold text-indigo-400 flex items-center justify-between">
                    <span>★★★ Confidence 3</span>
                    <span className="text-[10px] bg-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-300">max 2×</span>
                  </div>
                  <div className="text-[11px] mt-1 space-y-0.5">
                    <div className="text-emerald-400 font-semibold">✓ Zásah: +30 bodov <span className="text-slate-400 font-normal">(10 × 3)</span></div>
                    <div className="text-rose-400 font-semibold">✗ Vedľa: -15 bodov <span className="text-slate-400 font-normal">(-5 × 3)</span></div>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="font-bold text-blue-400 flex items-center justify-between">
                    <span>★★☆ Confidence 2</span>
                    <span className="text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300">max 2×</span>
                  </div>
                  <div className="text-[11px] mt-1 space-y-0.5">
                    <div className="text-emerald-400 font-semibold">✓ Zásah: +20 bodov <span className="text-slate-400 font-normal">(10 × 2)</span></div>
                    <div className="text-rose-400 font-semibold">✗ Vedľa: -10 bodov <span className="text-slate-400 font-normal">(-5 × 2)</span></div>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="font-bold text-amber-400 flex items-center justify-between">
                    <span>★☆☆ Confidence 1</span>
                    <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300">max 2×</span>
                  </div>
                  <div className="text-[11px] mt-1 space-y-0.5">
                    <div className="text-emerald-400 font-semibold">✓ Zásah: +10 bodov <span className="text-slate-400 font-normal">(10 × 1)</span></div>
                    <div className="text-rose-400 font-semibold">✗ Vedľa: -5 bodov <span className="text-slate-400 font-normal">(-5 × 1)</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TROPHIES_LIST.map((tDef, idx) => {
                const current = trophyPicks.find((tp) => tp.key === tDef.key) || {
                  key: tDef.key,
                  name: tDef.name,
                  confidence: 2,
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
                          <option value="">-- Vyberte tím / trénera --</option>
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
                          placeholder={`-- Hľadať ${tDef.name.split(" ")[0]} víťaza --`}
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

                    {/* Confidence Selector */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-400 font-medium">Confidence:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3].map((cVal) => (
                          <button
                            key={cVal}
                            type="button"
                            disabled={isLocked}
                            onClick={() => {
                              const updated = trophyPicks.filter((tp) => tp.key !== tDef.key);
                              updated.push({ ...current, confidence: cVal as any });
                              setFormPicks({ ...formPicks, trophies: updated });
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                              current.confidence === cVal
                                ? "bg-indigo-600 text-white shadow"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            }`}
                          >
                            {cVal === 3 ? "★★★ (3)" : cVal === 2 ? "★★☆ (2)" : "★☆☆ (1)"}
                          </button>
                        ))}
                      </div>
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
                  <h2 className="text-lg font-bold text-white">7. Over / Under (4 b za správny tip)</h2>
                  <p className="text-xs text-slate-400">Prekonajú vybraní hráči a tímy stanovenú bodovú hranicu?</p>
                </div>
              </div>
              <div className="text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                4b za každý správny tip
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
                  <h2 className="text-lg font-bold text-white">8. Head-to-Head Duely (3 b za správny tip)</h2>
                  <p className="text-xs text-slate-400">Kto dosiahne viac bodov v priamom mikrodueli?</p>
                </div>
              </div>
              <div className="text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                3b za každý správny duel
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
                  <h2 className="text-lg font-bold text-white">9. Bold Predictions (4 b za správny tip)</h2>
                  <p className="text-xs text-slate-400">Odvážne predsezónne výroky: Áno alebo Nie?</p>
                </div>
              </div>
              <div className="text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                4b za každý správny výrok
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
                        ÁNO ✓
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
                        NIE ✗
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
                  <h2 className="text-lg font-bold text-white">10. Wildcard: Sleeper & Bust tímy (Max 30 b)</h2>
                  <p className="text-xs text-slate-400">
                    Sleeper (prekvapenie sezóny) a Bust (očakávané sklamanie z top tímov).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-800/40">
                Sleeper: PO (+10b) / Divízia (+20b) | Bust: Mimo PO (+10b)
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                  <span>🚀 Sleeper Team (Skokan sezóny)</span>
                </div>
                <div className="text-xs text-slate-400">
                  Tím, od ktorého čakáte výrazne lepšiu sezónu. Postup do PO = +10b, výhra v divízii = +20b.
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
                  <option value="">-- Vyberte tím --</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-sm text-rose-400 flex items-center gap-2">
                  <span>📉 Bust Team (Sklamanie sezóny)</span>
                </div>
                <div className="text-xs text-slate-400">
                  Top tím z minulej sezóny (90+ bodov), ktorý nepostúpi do play-off (+10b).
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
                  <option value="">-- Vyberte tím (iba 90+ b minulú sezónu) --</option>
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
                <span>Upozornenie: Po odoslaní už nebude možné tipy meniť. Formulár môžete odoslať iba raz.</span>
              </div>
              <button
                onClick={handleSavePicks}
                disabled={isPending}
                className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-xl shadow-emerald-600/30 transition-all disabled:opacity-50 flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                {isPending ? "Odosielam..." : "🚀 Definitívne odoslať tiket (Nemožno meniť)"}
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
                <span>🏆 Poradie & Rebríček Tipovacej Ligy</span>
              </h2>
              <p className="text-xs text-slate-400">
                Oficiálne poradie generálnych manažérov v celosezónnej tipovačke.
              </p>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Celkovo odovzdaných tiketov: {submissions.length}
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              Zatiaľ neboli odoslané žiadne tipy.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Tím / GM</th>
                    <th className="py-3 px-3 text-center">SC</th>
                    <th className="py-3 px-3 text-center">Divízie</th>
                    <th className="py-3 px-3 text-center">Presidents</th>
                    <th className="py-3 px-3 text-center">Playoff</th>
                    <th className="py-3 px-3 text-center">Lídri</th>
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
                            👁️ Tiket
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
                        Tiket GM: {selectedSubmission.submittedBy || selectedSubmission.team?.name}
                      </h3>
                      <div className="text-xs text-slate-400">
                        Celkový počet bodov: <strong className="text-indigo-400 font-mono">{selectedSubmission.totalPoints} b</strong>
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
                    🔒 Tipy tohto GM sú skryté až do uzávierky (deadline).
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    {/* SC */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="font-bold text-slate-300 mb-1">1. Stanley Cup:</div>
                      <div className="text-slate-400">
                        Víťaz: <strong className="text-white">{teams.find((t: any) => t.id === selectedSubmission.picks.stanleyCup?.winnerTeamId)?.name || "—"}</strong> | Finalista: <strong className="text-white">{teams.find((t: any) => t.id === selectedSubmission.picks.stanleyCup?.finalistTeamId)?.name || "—"}</strong> | Séria: <strong className="text-white font-mono">{selectedSubmission.picks.stanleyCup?.seriesScore || "—"}</strong>
                      </div>
                    </div>

                    {/* Divs */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="font-bold text-slate-300 mb-1">2. Víťazi divízií:</div>
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
                        Tím: <strong className="text-white">{teams.find((t: any) => t.id === selectedSubmission.picks.presidentsTrophy?.teamId)?.name || "—"}</strong> ({selectedSubmission.picks.presidentsTrophy?.points} bodov)
                      </div>
                    </div>

                    {/* Playoff Teams */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="font-bold text-slate-300 mb-1">4. Playoff tímy ({selectedSubmission.picks.playoffTeams?.length || 0}/16):</div>
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
                      <div className="font-bold text-slate-300 mb-1">5. Štatistickí lídri:</div>
                      <div className="grid grid-cols-2 gap-2 text-slate-400">
                        <div>Art Ross: <strong className="text-white">{players.find((p: any) => p.id === selectedSubmission.picks.statLeaders?.artRossPlayerId)?.name || "—"}</strong></div>
                        <div>Richard: <strong className="text-white">{players.find((p: any) => p.id === selectedSubmission.picks.statLeaders?.rocketRichardPlayerId)?.name || "—"}</strong></div>
                        <div>Asistencie: <strong className="text-white">{players.find((p: any) => p.id === selectedSubmission.picks.statLeaders?.assistsPlayerId)?.name || "—"}</strong></div>
                        <div>Top Obranca: <strong className="text-white">{players.find((p: any) => p.id === selectedSubmission.picks.statLeaders?.topDmanPlayerId)?.name || "—"}</strong></div>
                        <div>Top Rookie: <strong className="text-white">{players.find((p: any) => p.id === selectedSubmission.picks.statLeaders?.topRookiePlayerId)?.name || "—"}</strong></div>
                      </div>
                    </div>

                    {/* Trophies */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="font-bold text-slate-300 mb-1">6. Trofeje:</div>
                      <div className="grid grid-cols-2 gap-2 text-slate-400">
                        {(selectedSubmission.picks.trophies || []).map((t: any) => (
                          <div key={t.key}>
                            {t.key}: <strong className="text-white">{t.playerName || t.teamName || "—"}</strong> (Conf {t.confidence})
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

      {/* TAB 3: DAILY PICKS PLACEHOLDER */}
      {tab === "daily" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-4">
          <div className="text-4xl">📅</div>
          <h2 className="text-xl font-bold text-white">Denná Tipovačka (Zápasové Tikety)</h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Denná tipovačka na jednotlivé zápasy simulácie s kurzami (1 - X - 2). GM budú môcť každý herný deň podať svoj denný tiket a zbierať body do celoročného rebríčka dennej tipovacej ligy.
          </p>
          <div className="inline-block px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            🚀 Štartuje už čoskoro so začiatkom základnej časti!
          </div>
        </div>
      )}

      {/* TAB 4: ADMIN CONTROLS */}
      {tab === "admin" && isAdmin && (
        <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                <span>⚙️ Administrácia & Vyhodnotenie Season Picks</span>
              </h2>
              <p className="text-xs text-slate-400">Nastavenie stavu, deadline a spustenie výpočtu bodov.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Stav tipovačky
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
                <option value="OPEN">🟢 OTVORENÁ (OPEN)</option>
                <option value="LOCKED">🔒 UZAMKNUTÁ (LOCKED)</option>
                <option value="RESOLVED">🏁 VYHODNOTENÁ (RESOLVED)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Deadline pre tipy
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
                      setMsg({ type: "success", text: `Úspešne prepočítaných ${res.count} tiketov.` });
                    } else if ("error" in res) {
                      setMsg({ type: "error", text: res.error || "Chyba pri vyhodnotení." });
                    }
                  });
                }}
                disabled={isPending}
                className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-600/30 transition-all text-sm disabled:opacity-50"
              >
                {isPending ? "Prepočítavam..." : "⚡ Spustiť Vyhodnotenie Bodov"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
