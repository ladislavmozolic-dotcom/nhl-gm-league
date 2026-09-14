"use client";

import { useState, type ReactNode } from "react";

export type TradeTabGroup = { key: string; label: string; count: number; items: ReactNode[] };

/** Tabbed trade list for a team's Trade Tracker — groups.length[0] (Approved)
 *  is always the default tab, regardless of whether it's empty, so a GM
 *  landing on the page sees real completed deals first, not clutter from
 *  declined/cancelled proposals. */
export default function TeamTradeTabs({ groups }: { groups: TradeTabGroup[] }) {
  const [active, setActive] = useState(groups[0]?.key);
  const activeGroup = groups.find((g) => g.key === active) ?? groups[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-slate-800">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setActive(g.key)}
            className={`px-3.5 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              active === g.key ? "border-blue-500 text-blue-400" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {g.label} <span className="text-xs text-slate-600">({g.count})</span>
          </button>
        ))}
      </div>
      {activeGroup?.items.length ? (
        <div className="space-y-4">{activeGroup.items}</div>
      ) : (
        <p className="text-slate-500 text-center py-8">No trades in this category.</p>
      )}
    </div>
  );
}
