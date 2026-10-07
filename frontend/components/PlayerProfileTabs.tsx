"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface PlayerProfileTabsProps {
  overviewContent: React.ReactNode;
  seasonsContent: React.ReactNode;
  availableSeasons: string[];
  currentSeason: string;
  playerSlugOrId: string | number;
  currentPhase?: string;
}

export default function PlayerProfileTabs({
  overviewContent,
  seasonsContent,
  availableSeasons,
  currentSeason,
  playerSlugOrId,
  currentPhase = "Základná časť",
}: PlayerProfileTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<"overview" | "seasons">(
    paramTab === "seasons" ? "seasons" : "overview"
  );

  useEffect(() => {
    if (paramTab === "seasons") {
      setActiveTab("seasons");
    } else if (paramTab === "overview") {
      setActiveTab("overview");
    }
  }, [paramTab]);

  const handleTabChange = (tab: "overview" | "seasons") => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "seasons") {
      url.searchParams.set("tab", "seasons");
    } else {
      url.searchParams.delete("tab");
    }
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800 self-start">
          <button
            type="button"
            onClick={() => handleTabChange("overview")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
              activeTab === "overview"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <span>👤</span>
            <span>Prehľad & Kariéra</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("seasons")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
              activeTab === "seasons"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <span>📊</span>
            <span>Sezóny & Analytika</span>
          </button>
        </div>

        {/* Season Dropdown & Current Phase badge when in Seasons tab */}
        {activeTab === "seasons" && (
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            {/* Aktuálna fáza sezóny */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-400 font-normal">Aktuálna fáza:</span>
              <span className="text-white font-bold">{currentPhase}</span>
            </div>

            {/* Dropdown pre prepínanie medzi sezónami */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="season-dropdown" className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                Sezóna:
              </label>
              <div className="relative">
                <select
                  id="season-dropdown"
                  value={currentSeason}
                  onChange={(e) => {
                    const newSeason = e.target.value;
                    router.push(`/players/${playerSlugOrId}?tab=seasons&season=${newSeason}`, { scroll: false });
                  }}
                  className="appearance-none bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-100 text-xs md:text-sm font-semibold rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm transition-colors"
                >
                  {availableSeasons.map((s) => (
                    <option key={s} value={s} className="bg-slate-900 text-slate-100">
                      {s}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Panels */}
      <div className={activeTab === "overview" ? "block space-y-6" : "hidden"}>
        {overviewContent}
      </div>
      <div className={activeTab === "seasons" ? "block space-y-6" : "hidden"}>
        {seasonsContent}
      </div>
    </div>
  );
}
