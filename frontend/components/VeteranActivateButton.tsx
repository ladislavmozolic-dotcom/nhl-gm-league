"use client";

import { useState, useTransition } from "react";
import { promoteVeteranAction } from "@/app/tools/player-calculator/actions";

/** "Activate" for a reserve/LTIR veteran who is playing again: writes his recalculated Live rating onto his card. */
export default function VeteranActivateButton({ playerId }: { playerId: number }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; s: string } | null>(null);

  if (status?.ok) return <span className="shrink-0 text-[10px] font-bold text-green-400 whitespace-nowrap">Activated ✓</span>;
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      {status && !status.ok && <span className="text-[10px] text-red-400">{status.s}</span>}
      <button
        type="button"
        disabled={pending}
        title="Apply the recalculated Live rating to this player's card (his reserve / LTIR status is not changed)"
        onClick={(e) => {
          e.stopPropagation();
          start(async () => {
            const r = await promoteVeteranAction(playerId);
            setStatus(r.ok ? { ok: true, s: "Activated ✓" } : { ok: false, s: r.error ?? "Failed" });
          });
        }}
        className="px-2 py-0.5 rounded bg-blue-600/80 hover:bg-blue-500 text-white text-[10px] font-semibold whitespace-nowrap disabled:opacity-50"
      >
        {pending ? "…" : "Activate"}
      </button>
    </span>
  );
}
