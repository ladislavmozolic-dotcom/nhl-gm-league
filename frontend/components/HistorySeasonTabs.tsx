"use client";

import { useState } from "react";

const TABS = ["Pre-season", "Regular Season", "Playoffs"] as const;
type Tab = (typeof TABS)[number];

export default function HistorySeasonTabs({ pre, regular, playoffs, defaultTab = "Regular Season" }: {
  pre: React.ReactNode; regular: React.ReactNode; playoffs: React.ReactNode; defaultTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const content = tab === "Pre-season" ? pre : tab === "Regular Season" ? regular : playoffs;
  return (
    <div>
      <div className="flex gap-1.5 mb-3">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>
            {t}
          </button>
        ))}
      </div>
      {content}
    </div>
  );
}
