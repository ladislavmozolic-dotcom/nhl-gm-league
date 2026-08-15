"use client";

import { useTransition } from "react";
import { startRoundAction } from "@/app/draft/room/actions";

export default function DraftRoundStarter({ round, live, status }: { round: number; live: boolean; status: string }) {
  const [pending, start] = useTransition();
  if (round < 1) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2.5">
      <span className="text-xs text-slate-500">Admin</span>
      <button
        onClick={() => start(async () => { await startRoundAction(round); })}
        disabled={pending || live}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-1.5"
      >
        {live ? `Round ${round} is live` : `Start Round ${round}`}
      </button>
      {status === "ROUND_DONE" && !live && <span className="text-xs text-emerald-400">Previous round complete — open the next.</span>}
    </div>
  );
}
