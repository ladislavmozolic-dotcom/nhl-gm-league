"use client";

import { useState } from "react";

/** Toggle between a player's Trade History and Transaction History cards —
 *  both are pre-rendered server content, this just switches which is shown. */
export default function PlayerHistoryTabs({ tradeCard, txCard }: { tradeCard: React.ReactNode; txCard: React.ReactNode }) {
  const [tab, setTab] = useState<"trade" | "tx">("trade");
  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${active ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-400 hover:text-slate-200"}`;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setTab("trade")} className={tabCls(tab === "trade")}>Trade History</button>
        <button type="button" onClick={() => setTab("tx")} className={tabCls(tab === "tx")}>Transaction History</button>
      </div>
      <div hidden={tab !== "trade"}>{tradeCard}</div>
      <div hidden={tab !== "tx"}>{txCard}</div>
    </div>
  );
}
