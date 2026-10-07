"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface PlayerProfileTabsProps {
  overviewContent: React.ReactNode;
  seasonsContent: React.ReactNode;
  availableSeasons: string[];
  currentSeason: string;
  playerSlugOrId: string | number;
}

export default function PlayerProfileTabs({
  overviewContent,
  seasonsContent,
  availableSeasons,
  currentSeason,
  playerSlugOrId,
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
    // Update query param smoothly without reloading page
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

        {/* Season Selector when in Seasons tab */}
        {activeTab === "seasons" && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
              Sezóna:
            </span>
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
              {availableSeasons.map((s) => {
                const isSelected = s === currentSeason;
                return (
                  <Link
                    key={s}
                    href={`/players/${playerSlugOrId}?tab=seasons&season=${s}`}
                    scroll={false}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      isSelected
                        ? "bg-blue-500/20 text-blue-300 border border-blue-400/40 shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    {s}
                  </Link>
                );
              })}
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
