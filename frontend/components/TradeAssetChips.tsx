"use client";

import Link from "next/link";
import type { AssetLabel } from "@/lib/trade-summary";

/** Trade Tracker asset chips — a player links to his profile, a prospect to his
 *  EliteProspects page (no internal route of its own). Lives inside ClickableCard
 *  (the whole trade row is itself a click target), so every chip stops propagation
 *  or its click would also fire the card's own navigation to the trade page. */
export default function TradeAssetChips({ items, kind }: { items: AssetLabel[]; kind: "get" | "give" }) {
  const cls = kind === "get"
    ? "px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm font-semibold text-emerald-50"
    : "px-2.5 py-1 rounded-lg bg-slate-700/30 border border-slate-600/50 text-sm font-semibold text-slate-100";
  const hoverCls = "hover:underline";
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (items.length === 0) return <div className="flex flex-wrap gap-1.5"><span className={cls}>Nothing</span></div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x, i) => {
        if (x.href && x.external) return <a key={i} href={x.href} target="_blank" rel="noopener noreferrer" onClick={stop} className={`${cls} ${hoverCls}`}>{x.text}</a>;
        if (x.href) return <Link key={i} href={x.href} onClick={stop} className={`${cls} ${hoverCls}`}>{x.text}</Link>;
        return <span key={i} className={cls}>{x.text}</span>;
      })}
    </div>
  );
}
