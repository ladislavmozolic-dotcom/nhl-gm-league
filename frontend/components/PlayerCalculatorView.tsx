"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PlayerLink from "@/components/PlayerLink";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";
import {
  ALL_SKATER_PARAMS,
  SKATER_PARAM_META,
  type SkaterParamKey,
  type ProjSkater,
} from "@/lib/param-projection";

interface TeamItem {
  id: number;
  slug: string;
  code: string | null;
  name: string;
  logoUrl: string | null;
  conference?: string | null;
  division?: string | null;
  affiliateTeams?: Array<{
    id: number;
    slug: string;
    code: string | null;
    name: string;
    logoUrl: string | null;
  }>;
}

type ViewMode = "diff" | "compare" | "projected";
type PosFilter = "ALL" | "F" | "D" | "C" | "W";

type SortConfig = {
  key: "name" | "pos" | "age" | "gp" | "ov" | SkaterParamKey;
  dir: "asc" | "desc";
};

const isDef = (pos: string | null) =>
  /\bD\b/.test((pos ?? "").toUpperCase()) ||
  ((pos ?? "").toUpperCase().includes("D") && !/[CW]/.test((pos ?? "").toUpperCase()));

const isCenter = (pos: string | null) => (pos ?? "").toUpperCase().includes("C");
const isWing = (pos: string | null) => /[LR]W|W\b/.test((pos ?? "").toUpperCase());

function ratingColor(val: number | null): string {
  if (val == null) return "text-slate-600";
  if (val >= 85) return "text-emerald-400 font-bold";
  if (val >= 80) return "text-sky-300 font-bold";
  if (val >= 70) return "text-slate-100 font-medium";
  if (val >= 60) return "text-slate-300";
  return "text-slate-500";
}

function posBadgeColor(pos: string | null): string {
  if (!pos) return "text-slate-400 bg-slate-800/60 border-slate-700";
  if (isDef(pos)) return "text-amber-300 bg-amber-500/10 border-amber-500/25";
  if (isCenter(pos)) return "text-blue-300 bg-blue-500/10 border-blue-500/25";
  return "text-emerald-300 bg-emerald-500/10 border-emerald-500/25";
}

export default function PlayerCalculatorView({
  teams,
  selectedTeam,
  allSkaters,
  active,
  lastWeight,
  curWeight,
  activateAtGp,
}: {
  teams: TeamItem[];
  selectedTeam: TeamItem;
  allSkaters: ProjSkater[];
  active: boolean;
  lastWeight: number;
  curWeight: number;
  activateAtGp: number;
}) {
  const router = useRouter();

  // Search & Filters state
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<PosFilter>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("diff");
  const [onlyChanges, setOnlyChanges] = useState(false);

  // Sorting state (default: overall desc)
  const [sort, setSort] = useState<SortConfig>({ key: "ov", dir: "desc" });

  // Hover card state for instant parameter comparison
  const [hovered, setHovered] = useState<{
    player: ProjSkater;
    x: number;
    y: number;
  } | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlayerMouseEnter = (e: React.MouseEvent, player: ProjSkater) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left;
    const y = r.bottom;
    hoverTimeout.current = setTimeout(() => {
      setHovered({ player, x, y });
    }, 120);
  };

  const handlePlayerMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      setHovered(null);
    }, 100);
  };

  const affiliate = selectedTeam.affiliateTeams?.[0] ?? null;
  const orgTeamIds = useMemo(
    () => new Set([selectedTeam.id, ...(affiliate ? [affiliate.id] : [])]),
    [selectedTeam.id, affiliate]
  );

  // Separate skaters into NHL vs AHL for the selected team
  const { nhlSkaters, ahlSkaters, otherTeamMatches } = useMemo(() => {
    const q = search.trim().toLowerCase();

    const nhl: ProjSkater[] = [];
    const ahl: ProjSkater[] = [];
    const otherMatches: Array<{ skater: ProjSkater; team: TeamItem }> = [];

    const teamsById = new Map<number, TeamItem>();
    teams.forEach((t) => {
      teamsById.set(t.id, t);
      t.affiliateTeams?.forEach((a) => {
        teamsById.set(a.id, t);
      });
    });

    for (const p of allSkaters) {
      const isMyOrg = orgTeamIds.has(p.teamId);
      const matchesSearch =
        !q ||
        cleanName(p.name).toLowerCase().includes(q) ||
        (p.position ?? "").toLowerCase().includes(q);

      // Check position filter
      let matchesPos = true;
      if (posFilter === "F") matchesPos = !isDef(p.position);
      else if (posFilter === "D") matchesPos = isDef(p.position);
      else if (posFilter === "C") matchesPos = isCenter(p.position);
      else if (posFilter === "W") matchesPos = isWing(p.position);

      // Check changes-only filter
      let hasChanges = false;
      if (onlyChanges) {
        hasChanges = ALL_SKATER_PARAMS.some(
          (k) => (p.projected[k] ?? 0) !== (p.actual[k] ?? 0)
        );
      }

      if (isMyOrg) {
        if (!matchesSearch || !matchesPos) continue;
        if (onlyChanges && !hasChanges) continue;

        // Is NHL or AHL
        if (p.rosterType === "AHL" || (affiliate && p.teamId === affiliate.id)) {
          ahl.push(p);
        } else {
          nhl.push(p);
        }
      } else if (q && q.length >= 2 && matchesSearch) {
        // Player on another team matches the search query!
        const ownerTeam = teamsById.get(p.teamId);
        if (ownerTeam && otherMatches.length < 5) {
          otherMatches.push({ skater: p, team: ownerTeam });
        }
      }
    }

    return { nhlSkaters: nhl, ahlSkaters: ahl, otherTeamMatches: otherMatches };
  }, [allSkaters, orgTeamIds, affiliate, search, posFilter, onlyChanges, teams]);

  // Sort helper
  const sortSkaters = (list: ProjSkater[]) => {
    return [...list].sort((a, b) => {
      let va: string | number | null = null;
      let vb: string | number | null = null;

      if (sort.key === "name") {
        va = cleanName(a.name).toLowerCase();
        vb = cleanName(b.name).toLowerCase();
      } else if (sort.key === "pos") {
        va = a.position ?? "";
        vb = b.position ?? "";
      } else if (sort.key === "age") {
        va = a.age ?? 0;
        vb = b.age ?? 0;
      } else if (sort.key === "gp") {
        va = a.gp ?? 0;
        vb = b.gp ?? 0;
      } else if (sort.key === "ov") {
        va = a.overall ?? 0;
        vb = b.overall ?? 0;
      } else {
        // Skater param
        va = (viewMode === "projected" ? a.projected[sort.key] : a.actual[sort.key]) ?? 0;
        vb = (viewMode === "projected" ? b.projected[sort.key] : b.actual[sort.key]) ?? 0;
      }

      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      if (typeof va === "number" && typeof vb === "number") {
        return sort.dir === "asc" ? va - vb : vb - va;
      }
      return sort.dir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  };

  const sortedNhl = useMemo(() => sortSkaters(nhlSkaters), [nhlSkaters, sort, viewMode]);
  const sortedAhl = useMemo(() => sortSkaters(ahlSkaters), [ahlSkaters, sort, viewMode]);

  const toggleSort = (key: SortConfig["key"]) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      // Default numbers desc, names asc
      const defaultDesc = key !== "name" && key !== "pos";
      return { key, dir: defaultDesc ? "desc" : "asc" };
    });
  };

  // Quick stats for the rosters
  const nhlAvgOv = useMemo(() => {
    const list = nhlSkaters.filter((p) => p.overall != null);
    if (!list.length) return 0;
    return (list.reduce((acc, p) => acc + (p.overall ?? 0), 0) / list.length).toFixed(1);
  }, [nhlSkaters]);

  const ahlAvgOv = useMemo(() => {
    const list = ahlSkaters.filter((p) => p.overall != null);
    if (!list.length) return 0;
    return (list.reduce((acc, p) => acc + (p.overall ?? 0), 0) / list.length).toFixed(1);
  }, [ahlSkaters]);

  const nhlChangesCount = useMemo(() => {
    return nhlSkaters.filter((p) =>
      ALL_SKATER_PARAMS.some((k) => (p.projected[k] ?? 0) !== (p.actual[k] ?? 0))
    ).length;
  }, [nhlSkaters]);

  const ahlChangesCount = useMemo(() => {
    return ahlSkaters.filter((p) =>
      ALL_SKATER_PARAMS.some((k) => (p.projected[k] ?? 0) !== (p.actual[k] ?? 0))
    ).length;
  }, [ahlSkaters]);

  return (
    <div className="space-y-6">
      {/* 1. TEAM SELECTOR STRIP */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-3 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between gap-3 mb-2 px-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>🏒 Select NHL Club</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500 font-normal">{teams.length} teams</span>
          </div>
          <div className="text-xs text-slate-500 hidden sm:block">
            Scroll or click to switch team
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin scrollbar-thumb-slate-700">
          {teams.map((t) => {
            const isSelected = t.id === selectedTeam.id;
            return (
              <Link
                key={t.id}
                href={`/tools/player-calculator?team=${t.slug}`}
                title={`${t.name} (${t.code})`}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all shrink-0 text-xs font-semibold ${
                  isSelected
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-400 text-white shadow-md shadow-blue-900/40 scale-[1.02]"
                    : "bg-slate-800/50 border-slate-700/70 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
                }`}
              >
                {t.logoUrl ? (
                  <img
                    src={t.logoUrl}
                    alt={t.code ?? ""}
                    className="w-5 h-5 object-contain shrink-0"
                  />
                ) : (
                  <span className="w-5 h-5 rounded bg-slate-700 grid place-items-center text-[10px] font-bold">
                    {t.code}
                  </span>
                )}
                <span>{t.code}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 2. ACTIVE TEAM HERO CARD */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-[#0d1c31] to-slate-900 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {selectedTeam.logoUrl ? (
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 p-2 grid place-items-center shadow-inner shrink-0">
                <img
                  src={selectedTeam.logoUrl}
                  alt={selectedTeam.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-blue-600/30 border border-blue-500/40 grid place-items-center text-xl font-bold text-white shrink-0">
                {selectedTeam.code}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {selectedTeam.name}
                </h1>
                {selectedTeam.conference && (
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                    {selectedTeam.conference}
                  </span>
                )}
                {selectedTeam.division && (
                  <span className="text-[11px] font-medium text-slate-400">
                    {selectedTeam.division}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-slate-400">
                <span>
                  <b>{nhlSkaters.length}</b> NHL Skaters (Avg OV: <b>{nhlAvgOv}</b>)
                </span>
                <span className="text-slate-600">·</span>
                <span>
                  <b>{ahlSkaters.length}</b> AHL Skaters (Avg OV: <b>{ahlAvgOv}</b>)
                </span>
                {affiliate && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <span>Farma:</span>
                      {affiliate.logoUrl && (
                        <img
                          src={affiliate.logoUrl}
                          alt=""
                          className="w-4 h-4 object-contain inline"
                        />
                      )}
                      <b>{affiliate.name}</b>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Status Pill */}
          <div className="flex sm:flex-col items-end gap-1.5 text-right w-full sm:w-auto">
            <div
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border inline-flex items-center gap-1.5 ${
                active
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              <span>{active ? "Live NHL Form Active" : "Off-season / Reference Model"}</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Formula: {Math.round(lastWeight * 100)}% minulá + {Math.round(curWeight * 100)}% táto sezóna
            </span>
          </div>
        </div>
      </div>

      {/* 3. TOOLBAR: SEARCH, POSITION TABS, VIEW MODES */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3.5 shadow-lg">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Live Search Input */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
              🔍
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player by name or position..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800 text-xs font-semibold self-start md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("diff")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === "diff"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Všetky parametre s indikátormi prepočítaných zmien"
            >
              All Params (Diff)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compare")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === "compare"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Porovnanie Aktuálne → Prepočítané"
            >
              Compare
            </button>
            <button
              type="button"
              onClick={() => setViewMode("projected")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === "projected"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Zobraziť s aplikovanými prepočítanými hodnotami"
            >
              Projected
            </button>
          </div>
        </div>

        {/* Secondary filters row */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-slate-800/60 text-xs">
          {/* Position Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 font-medium mr-1">Position:</span>
            {(
              [
                { key: "ALL", label: "All Skaters" },
                { key: "F", label: "Forwards" },
                { key: "D", label: "Defense" },
                { key: "C", label: "Centers" },
                { key: "W", label: "Wings" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPosFilter(item.key)}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  posFilter === item.key
                    ? "bg-slate-700 border-slate-500 text-white font-semibold"
                    : "bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Only Changes Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={onlyChanges}
              onChange={(e) => setOnlyChanges(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
            />
            <span>Iba hráči so zmenou (▲ / ▼)</span>
          </label>
        </div>

        {/* Cross-Team Search Prompt */}
        {otherTeamMatches.length > 0 && (
          <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2 flex-wrap text-xs text-slate-400">
            <span className="text-amber-300 font-semibold">💡 Nájdené v iných tímoch:</span>
            {otherTeamMatches.map(({ skater, team: t }) => (
              <button
                key={skater.id}
                type="button"
                onClick={() => router.push(`/tools/player-calculator?team=${t.slug}`)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all"
              >
                {t.logoUrl && <img src={t.logoUrl} alt="" className="w-3.5 h-3.5 object-contain" />}
                <span className="font-semibold text-white">{cleanName(skater.name)}</span>
                <span className="text-slate-400">({t.code})</span>
                <span className="text-blue-400 ml-0.5">→</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. ROSTER SECTIONS */}
      {/* SECTION A: NHL ROSTER */}
      <RosterSection
        title={`${selectedTeam.name} — NHL Roster`}
        badgeText="NHL"
        badgeColor="bg-blue-600/20 text-blue-300 border-blue-500/30"
        teamLogo={selectedTeam.logoUrl}
        skaters={sortedNhl}
        totalCount={nhlSkaters.length}
        changesCount={nhlChangesCount}
        avgOv={nhlAvgOv}
        active={active}
        viewMode={viewMode}
        sort={sort}
        onSort={toggleSort}
        onRowMouseEnter={handlePlayerMouseEnter}
        onRowMouseLeave={handlePlayerMouseLeave}
        emptyMessage={
          search || posFilter !== "ALL" || onlyChanges
            ? "Žiadni NHL hráči nezodpovedajú filtrom."
            : "Tento tím nemá žiadnych korčuliarov na NHL súpiske."
        }
      />

      {/* SECTION B: AHL ROSTER (FARM) */}
      <RosterSection
        title={
          affiliate
            ? `${affiliate.name} — AHL Farm Roster`
            : `${selectedTeam.name} — AHL Farm Roster`
        }
        badgeText="AHL"
        badgeColor="bg-purple-600/20 text-purple-300 border-purple-500/30"
        teamLogo={affiliate?.logoUrl ?? selectedTeam.logoUrl}
        skaters={sortedAhl}
        totalCount={ahlSkaters.length}
        changesCount={ahlChangesCount}
        avgOv={ahlAvgOv}
        active={active}
        viewMode={viewMode}
        sort={sort}
        onSort={toggleSort}
        onRowMouseEnter={handlePlayerMouseEnter}
        onRowMouseLeave={handlePlayerMouseLeave}
        emptyMessage={
          search || posFilter !== "ALL" || onlyChanges
            ? "Žiadni AHL hráči nezodpovedajú filtrom."
            : "Tento tím nemá žiadnych korčuliarov na AHL súpiske."
        }
      />

      {/* Hover comparison popover card */}
      <PlayerHoverComparisonCard hovered={hovered} />

      {/* FOOTER EXPLANATION */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 text-xs text-slate-500 space-y-1.5">
        <p>
          <strong className="text-slate-300">Všetky parametre pripravené na prepočet:</strong>{" "}
          Zobrazuje kompletných 15 parametrov (CK, FG, DI, SK, ST, EN, DU, PH, FO, PA, SC, DF, PS, EX, LD). Parametre s aktívnymi vzorcami (CK, SC, PA, DF) sú zvýraznené hviezdičkou <span className="text-amber-400 font-bold">*</span>. Ostatné parametre sú pripravené na doplnenie ďalších vzorcov. Prejdením myšou (hover) na hráča sa zobrazí okamžité porovnanie aktuálnych hodnôt a odhadov.
        </p>
        <p>
          <strong className="text-slate-300">Penalizácia za zranenia (GP):</strong> Hráč, ktorý vynechá ≥25 % zápasov, stráca −1 zo všetkých odhadov, pri ≥50 % stráca −2 a pri ≥75 % −3.
        </p>
      </div>
    </div>
  );
}

// Subcomponent: Render one roster table (NHL or AHL)
function RosterSection({
  title,
  badgeText,
  badgeColor,
  teamLogo,
  skaters,
  totalCount,
  changesCount,
  avgOv,
  active,
  viewMode,
  sort,
  onSort,
  onRowMouseEnter,
  onRowMouseLeave,
  emptyMessage,
}: {
  title: string;
  badgeText: string;
  badgeColor: string;
  teamLogo: string | null;
  skaters: ProjSkater[];
  totalCount: number;
  changesCount: number;
  avgOv: string | number;
  active: boolean;
  viewMode: ViewMode;
  sort: SortConfig;
  onSort: (k: SortConfig["key"]) => void;
  onRowMouseEnter: (e: React.MouseEvent, p: ProjSkater) => void;
  onRowMouseLeave: () => void;
  emptyMessage: string;
}) {
  const arrow = (k: SortConfig["key"]) =>
    sort.key === k ? (sort.dir === "asc" ? " ▲" : " ▾") : "";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl">
      {/* Header bar */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          {teamLogo ? (
            <img src={teamLogo} alt="" className="w-6 h-6 object-contain shrink-0" />
          ) : (
            <span className="w-6 h-6 rounded bg-slate-800 grid place-items-center text-[10px] font-bold text-slate-300">
              {badgeText}
            </span>
          )}
          <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeColor}`}>
            {badgeText}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            Korčuliari: <b className="text-white">{skaters.length}</b>
            {totalCount !== skaters.length && (
              <span className="text-slate-500 font-normal"> / {totalCount}</span>
            )}
          </span>
          <span className="text-slate-700">·</span>
          <span>
            Priem. OV: <b className="text-blue-300">{avgOv}</b>
          </span>
          {changesCount > 0 && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-emerald-400 font-medium">
                {changesCount} so zmenou
              </span>
            </>
          )}
        </div>
      </div>

      {/* Table container with sticky headers and scroll */}
      <div className="overflow-x-auto max-h-[580px] overflow-y-auto overscroll-contain">
        <table className="w-full text-xs text-left" style={{ minWidth: 1040 }}>
          <thead>
            <tr className="bg-slate-950/95 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider sticky top-0 z-20 select-none backdrop-blur-md">
              {/* Sticky Player Name & Number */}
              <th
                onClick={() => onSort("name")}
                className="py-2.5 px-3 font-bold text-slate-300 hover:text-white cursor-pointer sticky left-0 z-30 bg-slate-950 min-w-[190px] border-r border-slate-800/80"
              >
                Hráč{arrow("name")}
              </th>

              {/* Position */}
              <th
                onClick={() => onSort("pos")}
                className="py-2.5 px-2 text-center font-bold hover:text-white cursor-pointer w-12"
              >
                Poz{arrow("pos")}
              </th>

              {/* Age */}
              <th
                onClick={() => onSort("age")}
                className="py-2.5 px-2 text-center font-bold hover:text-white cursor-pointer w-10"
              >
                Vek{arrow("age")}
              </th>

              {/* GP */}
              <th
                onClick={() => onSort("gp")}
                className="py-2.5 px-2 text-center font-bold hover:text-white cursor-pointer w-12"
                title="Zápasy v aktuálnej NHL sezóne"
              >
                GP{arrow("gp")}
              </th>

              {/* Overall */}
              <th
                onClick={() => onSort("ov")}
                className="py-2.5 px-2.5 text-center font-black text-blue-300 hover:text-blue-200 cursor-pointer w-12 border-r border-slate-800/80 bg-blue-950/20"
                title="Celkový rating (Overall)"
              >
                OV{arrow("ov")}
              </th>

              {/* All 15 Parameters */}
              {ALL_SKATER_PARAMS.map((k) => {
                const meta = SKATER_PARAM_META[k];
                const isCalculated = meta.hasFormula;
                const isSorted = sort.key === k;
                return (
                  <th
                    key={k}
                    onClick={() => onSort(k)}
                    className={`py-2.5 px-1.5 text-center font-bold hover:text-white cursor-pointer transition-colors ${
                      isCalculated ? "text-amber-300/90 hover:text-amber-200" : "text-slate-300"
                    } ${isSorted ? "bg-slate-800/50" : ""}`}
                    title={`${meta.label} — ${meta.name}${isCalculated ? " (Aktívny prepočet vzorcom)" : " (Zatiaľ základná hodnota)"}`}
                  >
                    <span className="inline-flex items-center justify-center gap-0.5">
                      <span>{meta.label}</span>
                      {isCalculated && <span className="text-amber-400 font-black text-[10px]">*</span>}
                    </span>
                    {arrow(k)}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {skaters.length === 0 ? (
              <tr>
                <td
                  colSpan={20}
                  className="py-10 text-center text-slate-500 text-sm font-medium"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              skaters.map((p) => {
                return (
                  <tr
                    key={p.id}
                    onMouseEnter={(e) => onRowMouseEnter(e, p)}
                    onMouseLeave={onRowMouseLeave}
                    className="hover:bg-slate-800/40 transition-colors group cursor-default"
                  >
                    {/* Sticky Name Cell */}
                    <td className="py-2 px-3 sticky left-0 z-10 bg-slate-900/95 group-hover:bg-slate-850/95 backdrop-blur-sm border-r border-slate-800/80">
                      <div className="flex items-center gap-2.5 min-w-[170px]">
                        <PlayerAvatar src={p.photoUrl} alt={p.name} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {p.number != null && (
                              <span className="text-[10px] font-mono text-slate-500">
                                #{p.number}
                              </span>
                            )}
                            <PlayerLink
                              slug={p.slug}
                              id={p.id}
                              name={p.name}
                              className="font-semibold text-white truncate hover:underline"
                            />
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${posBadgeColor(
                          p.position
                        )}`}
                      >
                        {p.position ?? "—"}
                      </span>
                    </td>

                    {/* Age */}
                    <td className="py-2 px-2 text-center text-slate-400 tabular-nums">
                      {p.age ?? "—"}
                    </td>

                    {/* GP (with missed games penalty indicator) */}
                    <td className="py-2 px-2 text-center tabular-nums">
                      {active ? (
                        <div className="inline-flex items-center gap-1">
                          <span className="text-slate-200">{p.gp}</span>
                          {p.missedPenalty > 0 && (
                            <span
                              className="text-[10px] font-bold text-rose-400 px-1 py-0.2 rounded bg-rose-500/10 border border-rose-500/30"
                              title={`Vynechal značnú časť sezóny: penalizácia −${p.missedPenalty} na prepočítaných parametroch`}
                            >
                              −{p.missedPenalty}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">{p.gp > 0 ? p.gp : "—"}</span>
                      )}
                    </td>

                    {/* Overall */}
                    <td className="py-2 px-2 text-center tabular-nums border-r border-slate-800/80 bg-blue-950/10">
                      <span className="inline-block px-1.5 py-0.5 rounded font-black text-blue-300 bg-blue-500/15 border border-blue-500/30">
                        {p.overall ?? "—"}
                      </span>
                    </td>

                    {/* 15 Skater Parameters */}
                    {ALL_SKATER_PARAMS.map((k) => {
                      const act = p.actual[k];
                      const proj = p.projected[k];
                      const diff = act != null && proj != null ? proj - act : 0;
                      const hasFormula = SKATER_PARAM_META[k].hasFormula;

                      // What value to show depending on viewMode
                      let displayVal = act;
                      if (viewMode === "projected") {
                        displayVal = proj ?? act;
                      }

                      return (
                        <td
                          key={k}
                          className={`py-2 px-1.5 text-center tabular-nums ${
                            hasFormula ? "bg-amber-950/5" : ""
                          }`}
                        >
                          {viewMode === "compare" ? (
                            // Compare view: e.g. "72 → 75 (+3)"
                            <div className="flex items-center justify-center gap-1 text-[11px] whitespace-nowrap">
                              <span className={ratingColor(act)}>{act ?? "—"}</span>
                              {diff !== 0 && (
                                <>
                                  <span className="text-slate-500 text-[9px]">→</span>
                                  <span
                                    className={`font-bold ${
                                      diff > 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}
                                  >
                                    {proj}
                                  </span>
                                </>
                              )}
                            </div>
                          ) : (
                            // Diff or Projected view
                            <div className="inline-flex items-center justify-center gap-0.5">
                              <span className={ratingColor(displayVal)}>
                                {displayVal ?? "—"}
                              </span>
                              {viewMode === "diff" && diff !== 0 && (
                                <span
                                  className={`text-[9px] font-bold ${
                                    diff > 0 ? "text-emerald-400" : "text-rose-400"
                                  }`}
                                  title={`Aktuálne: ${act} → Prepočítané: ${proj} (${diff > 0 ? `+${diff}` : diff})`}
                                >
                                  {diff > 0 ? `+${diff}` : diff}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Floating comparison card displayed on row hover
function PlayerHoverComparisonCard({
  hovered,
}: {
  hovered: { player: ProjSkater; x: number; y: number } | null;
}) {
  if (!hovered) return null;
  const { player: p, x, y } = hovered;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  const cardWidth = 760;
  const cardHeight = 290;

  // Position vertically: below cursor row if space, else above
  let top = y + 8;
  if (top + cardHeight > vh - 16) {
    top = Math.max(10, y - cardHeight - 44);
  }

  // Position horizontally: keep within screen padding
  let left = Math.max(16, Math.min(x, vw - cardWidth - 20));

  const changes = ALL_SKATER_PARAMS.map((k) => {
    const act = p.actual[k];
    const proj = p.projected[k];
    const diff = act != null && proj != null ? proj - act : 0;
    return { key: k, meta: SKATER_PARAM_META[k], act, proj, diff };
  }).filter((c) => c.diff !== 0);

  return (
    <div
      style={{
        position: "fixed",
        top,
        left,
        width: Math.min(cardWidth, vw - 32),
        zIndex: 100,
      }}
      className="pointer-events-none rounded-3xl border border-slate-700/90 bg-slate-950/98 p-5 shadow-2xl backdrop-blur-3xl ring-2 ring-white/10 animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header with larger avatar and prominent Overall */}
      <div className="flex items-center justify-between gap-4 pb-3.5 mb-3.5 border-b border-slate-800">
        <div className="flex items-center gap-3.5 min-w-0">
          <PlayerAvatar src={p.photoUrl} alt={p.name} size={48} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {p.number != null && (
                <span className="text-sm font-mono text-slate-500 font-bold">
                  #{p.number}
                </span>
              )}
              <span className="font-black text-white text-lg tracking-tight truncate">
                {cleanName(p.name)}
              </span>
              <span
                className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${posBadgeColor(
                  p.position
                )}`}
              >
                {p.position ?? "—"}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2.5 flex-wrap">
              {p.age != null && <span><b>{p.age}</b> rokov</span>}
              {p.gp > 0 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span><b>{p.gp}</b> GP (NHL)</span>
                </>
              )}
              {p.missedPenalty > 0 && (
                <span className="text-xs text-rose-400 font-bold bg-rose-500/15 border border-rose-500/40 px-2 py-0.5 rounded-lg">
                  Penalizácia za zranenia −{p.missedPenalty}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">
              Celkový Rating
            </div>
            <div className="text-2xl font-black text-blue-300 px-3 py-1 rounded-xl bg-blue-600/20 border border-blue-500/40 tabular-nums">
              {p.overall ?? "—"} <span className="text-xs font-bold text-blue-400">OV</span>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Matrix: Tento rok vs Projected (Larger size) */}
      <div className="overflow-x-auto pb-1.5 scrollbar-thin">
        <table className="w-full text-center text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase font-extrabold text-slate-400">
              <th className="py-1.5 px-2 text-left text-slate-500 min-w-[85px]">
                Stav
              </th>
              {ALL_SKATER_PARAMS.map((k) => (
                <th
                  key={k}
                  className={`py-1.5 px-1.5 min-w-[38px] ${
                    SKATER_PARAM_META[k].hasFormula
                      ? "text-amber-300 font-black"
                      : "text-slate-400 font-bold"
                  }`}
                  title={SKATER_PARAM_META[k].name}
                >
                  <span className="inline-flex items-center justify-center gap-0.5">
                    <span>{SKATER_PARAM_META[k].label}</span>
                    {SKATER_PARAM_META[k].hasFormula && (
                      <span className="text-amber-400 text-xs font-black">*</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {/* Row 1: Tento rok */}
            <tr>
              <td className="py-2.5 px-2 text-left font-sans text-xs font-bold text-slate-400">
                Tento rok
              </td>
              {ALL_SKATER_PARAMS.map((k) => (
                <td
                  key={k}
                  className={`py-2.5 px-1.5 font-bold ${ratingColor(p.actual[k])}`}
                >
                  {p.actual[k] ?? "—"}
                </td>
              ))}
            </tr>

            {/* Row 2: Projected */}
            <tr className="bg-slate-900/90">
              <td className="py-2.5 px-2 text-left font-sans text-xs font-black text-blue-300">
                Projected
              </td>
              {ALL_SKATER_PARAMS.map((k) => {
                const act = p.actual[k];
                const proj = p.projected[k];
                const diff = act != null && proj != null ? proj - act : 0;
                return (
                  <td
                    key={k}
                    className={`py-2.5 px-1.5 font-black text-[15px] ${
                      diff > 0
                        ? "text-emerald-400"
                        : diff < 0
                        ? "text-rose-400"
                        : "text-slate-300"
                    }`}
                  >
                    {proj ?? act ?? "—"}
                  </td>
                );
              })}
            </tr>

            {/* Row 3: Rozdiel */}
            <tr className="text-xs">
              <td className="py-1.5 px-2 text-left font-sans font-semibold text-slate-500">
                Zmena (Δ)
              </td>
              {ALL_SKATER_PARAMS.map((k) => {
                const act = p.actual[k];
                const proj = p.projected[k];
                const diff = act != null && proj != null ? proj - act : 0;
                return (
                  <td
                    key={k}
                    className={`py-1.5 px-1.5 font-black text-xs ${
                      diff > 0
                        ? "text-emerald-400"
                        : diff < 0
                        ? "text-rose-400"
                        : "text-slate-600"
                    }`}
                  >
                    {diff > 0 ? `+${diff}` : diff < 0 ? diff : "·"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Changes breakdown pills */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs flex-wrap">
        {changes.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-semibold">Odhadované zmeny:</span>
            {changes.map((c) => (
              <span
                key={c.key}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs inline-flex items-center gap-1 ${
                  c.diff > 0
                    ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300"
                    : "bg-rose-500/15 border border-rose-500/40 text-rose-300"
                }`}
              >
                <span>{c.meta.label}</span>
                <span>{c.diff > 0 ? `+${c.diff}` : c.diff}</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-slate-500 italic text-xs">
            Všetky parametre zatiaľ stabilné (bez odhadovanej zmeny)
          </span>
        )}
        <span className="text-[11px] text-slate-500 ml-auto">
          * Parametre s aktívnym vzorcom
        </span>
      </div>
    </div>
  );
}


