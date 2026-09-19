"use client";

import { useState, useTransition } from "react";
import { money } from "@/lib/finance";

export type BuyoutTerms = { perYear: number; years: number; totalCost: number; pct: number };

export default function BuyoutButton({ slug, playerId, playerName, onBuyout, terms }: {
  slug: string; playerId: number; playerName: string;
  onBuyout: (slug: string, playerId: number) => Promise<void>;
  terms: BuyoutTerms;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const buy = () => {
    const msg = `Buy out ${playerName}?\n\n`
      + `Rate: ${terms.pct}% of the cap hit\n`
      + `Dead cap: ${money(terms.perYear)} per season × ${terms.years} seasons\n`
      + `Total dead cap: ${money(terms.totalCost)}\n\n`
      + `No cash is deducted from the team bank.`;
    if (!confirm(msg)) return;
    start(async () => {
      setErr(null);
      try { await onBuyout(slug, playerId); }
      catch (e) { setErr((e as Error).message); }
    });
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button onClick={buy} disabled={pending}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-700/60 text-red-400 hover:bg-red-950/40 disabled:opacity-40"
        title={`Buy out this contract — ${money(terms.perYear)}/yr dead cap × ${terms.years}yr (${money(terms.totalCost)} total)`}>
        {pending ? "…" : "Buy out"}
      </button>
      {err && <span className="text-[10px] text-red-400">{err}</span>}
    </span>
  );
}
