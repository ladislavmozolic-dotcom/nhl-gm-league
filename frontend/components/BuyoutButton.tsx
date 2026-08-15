"use client";

import { useState, useTransition } from "react";

export default function BuyoutButton({ slug, playerId, playerName, onBuyout }: {
  slug: string; playerId: number; playerName: string;
  onBuyout: (slug: string, playerId: number, inSeason: boolean) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const buy = () => {
    if (!confirm(`Buy out ${playerName}? Dead-money cap over 2× the remaining years and the cost is debited from your bank.`)) return;
    start(async () => {
      setErr(null);
      try { await onBuyout(slug, playerId, true); }
      catch (e) { setErr((e as Error).message); }
    });
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button onClick={buy} disabled={pending}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-700/60 text-red-400 hover:bg-red-950/40 disabled:opacity-40"
        title="Buy out this contract">
        {pending ? "…" : "Buy out"}
      </button>
      {err && <span className="text-[10px] text-red-400">{err}</span>}
    </span>
  );
}
