"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";

export type CaptainPlayer = {
  id: number;
  name: string;
  slug: string;
  photoUrl: string | null;
  position: string | null;
  number: number | null;
  role: "C" | "A" | null;
};

export type TeamLeadership = {
  id: number;
  name: string;
  code: string | null;
  logoUrl: string | null;
  slug: string;
  league: string;
  conference?: string | null;
  captain?: CaptainPlayer;
  assistants: CaptainPlayer[];
};

export default function CaptainsShowcase({
  nhlTeams,
  ahlTeams,
  lang = "en",
}: {
  nhlTeams: TeamLeadership[];
  ahlTeams: TeamLeadership[];
  lang?: string;
}) {
  const isCs = lang === "cs";

  const [leagueFilter, setLeagueFilter] = useState<"ALL" | "NHL" | "AHL">("NHL");
  const [q, setQ] = useState("");

  const allTeams = useMemo(() => [...nhlTeams, ...ahlTeams], [nhlTeams, ahlTeams]);

  // KPI metrics
  const metrics = useMemo(() => {
    const target = leagueFilter === "ALL" ? allTeams : leagueFilter === "NHL" ? nhlTeams : ahlTeams;
    const totalClubs = target.length;
    const withC = target.filter((t) => !!t.captain).length;
    const vacant = totalClubs - withC;
    const totalA = target.reduce((s, t) => s + t.assistants.length, 0);

    return { totalClubs, withC, vacant, totalA };
  }, [allTeams, nhlTeams, ahlTeams, leagueFilter]);

  const filteredTeams = useMemo(() => {
    const list = leagueFilter === "ALL" ? allTeams : leagueFilter === "NHL" ? nhlTeams : ahlTeams;
    const query = q.trim().toLowerCase();
    if (!query) return list;

    return list.filter((t) => {
      const matchTeam = t.name.toLowerCase().includes(query) || (t.code?.toLowerCase().includes(query) ?? false);
      const matchCaptain = t.captain && cleanName(t.captain.name).toLowerCase().includes(query);
      const matchAssistants = t.assistants.some((a) => cleanName(a.name).toLowerCase().includes(query));
      return matchTeam || matchCaptain || matchAssistants;
    });
  }, [allTeams, nhlTeams, ahlTeams, leagueFilter, q]);

  return (
    <div className="space-y-6">
      {/* Top KPI Deck */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Počet tímov" : "Total Teams"}
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {metrics.totalClubs}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {leagueFilter === "ALL" ? "NHL & AHL" : leagueFilter}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Vymenovaní kapitáni" : "Named Captains"}
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1 flex items-baseline gap-1.5">
            <span>{metrics.withC}</span>
            <span className="text-xs font-semibold text-slate-400">/ {metrics.totalClubs}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isCs ? "Klubov s písmenom C" : "Clubs with active C"}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Bez kapitána (voľné)" : "Vacant Captaincy"}
          </div>
          <div className="text-2xl font-black text-slate-300 mt-1">
            {metrics.vacant}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isCs ? "Rotujúci alebo neurčení" : "No permanent C named"}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Asistenti kapitána (A)" : "Alternate Captains (A)"}
          </div>
          <div className="text-2xl font-black text-sky-400 mt-1">
            {metrics.totalA}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isCs ? "Vedenie kabíny" : "Leadership group members"}
          </div>
        </div>
      </div>

      {/* Control & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 backdrop-blur">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isCs ? "Hľadať tím, kapitána alebo asistenta..." : "Search team, captain or assistant..."}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* League Switcher */}
        <div className="inline-flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
          <button
            onClick={() => setLeagueFilter("NHL")}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              leagueFilter === "NHL" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            NHL
          </button>
          <button
            onClick={() => setLeagueFilter("AHL")}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              leagueFilter === "AHL" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            AHL
          </button>
          <button
            onClick={() => setLeagueFilter("ALL")}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              leagueFilter === "ALL" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            {isCs ? "Všetky tímy" : "All Teams"}
          </button>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeams.map((t) => (
          <div
            key={t.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md backdrop-blur overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-colors"
          >
            {/* Team Header */}
            <Link
              href={`/teams/${t.slug}`}
              className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-800/60 to-slate-900/80 border-b border-slate-800 hover:from-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {t.logoUrl && <img src={t.logoUrl} alt="" className="w-7 h-7 object-contain shrink-0" />}
                <div>
                  <span className="font-bold text-sm text-white block">{t.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                    {t.code} {t.conference ? `· ${t.conference}` : ""}
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                t.league === "NHL" ? "bg-blue-500/10 text-blue-300 border-blue-500/20" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
              }`}>
                {t.league}
              </span>
            </Link>

            {/* Leadership Body */}
            <div className="p-4 space-y-4 flex-1">
              {/* Captain (C) */}
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {isCs ? "Kapitán" : "Captain"}
                </div>
                {t.captain ? (
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <PlayerAvatar src={t.captain.photoUrl} alt={t.captain.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/players/${t.captain.slug}`}
                          className="font-bold text-sm text-white hover:text-amber-400 transition-colors truncate"
                        >
                          {cleanName(t.captain.name)}
                        </Link>
                        {t.captain.number != null && (
                          <span className="text-xs text-amber-400/90 font-mono font-bold">
                            #{t.captain.number}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{t.captain.position}</span>
                    </div>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-sm shadow-amber-500/20">
                      C
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center">
                    <span className="text-xs text-slate-500 font-medium italic">
                      {isCs ? "Pozícia kapitána je voľná" : "Captaincy Vacant"}
                    </span>
                  </div>
                )}
              </div>

              {/* Assistants (A) */}
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  {isCs ? "Asistenti kapitána" : "Alternate Captains"}
                </div>
                {t.assistants.length > 0 ? (
                  <div className="space-y-1.5">
                    {t.assistants.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2.5 p-1.5 rounded-lg bg-slate-800/40 border border-slate-800/80 hover:bg-slate-800/60 transition-colors"
                      >
                        <PlayerAvatar src={a.photoUrl} alt={a.name} size={28} />
                        <div className="min-w-0 flex-1 flex items-center justify-between pr-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <Link
                              href={`/players/${a.slug}`}
                              className="font-semibold text-xs text-slate-200 hover:text-blue-400 transition-colors truncate"
                            >
                              {cleanName(a.name)}
                            </Link>
                            {a.number != null && (
                              <span className="text-[11px] text-slate-500 font-mono">
                                #{a.number}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">{a.position}</span>
                        </div>
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-black bg-slate-700 text-slate-200 border border-slate-600 shrink-0">
                          A
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 pl-1 italic">
                    {isCs ? "Žiadni určení asistenti" : "No alternates named"}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredTeams.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            {isCs ? "Filtrom nevyhovujú žiadne tímy." : "No teams match your search."}
          </div>
        )}
      </div>
    </div>
  );
}
