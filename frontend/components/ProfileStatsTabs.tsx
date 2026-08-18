"use client";

import { useState } from "react";

/** Tabbed header for the profile's Player Stats card: "Season" (totals split by
 *  league) vs "Game Log" (game-by-game NHL). Both panels are server-rendered and
 *  passed in as children; this just toggles which one shows. */
export default function ProfileStatsTabs({ season, gameLog }: { season: React.ReactNode; gameLog: React.ReactNode }) {
  const [tab, setTab] = useState<"season" | "log">("season");
  const btn = (k: "season" | "log", label: string) =>
    <button onClick={() => setTab(k)}
      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${tab === k ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>{label}</button>;
  return (
    <div>
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-800">
        <span className="text-sm font-bold uppercase tracking-wide text-slate-300 mr-1">Player Stats</span>
        {btn("season", "Season")}
        {btn("log", "Game Log")}
      </div>
      <div className="p-4">{tab === "season" ? season : gameLog}</div>
    </div>
  );
}
