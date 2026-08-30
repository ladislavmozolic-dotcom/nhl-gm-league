"use client";

import { useState, useTransition } from "react";
import { restartSeasonAction } from "@/app/admin/season/actions";
import { friendlyActionError } from "@/lib/client/action-error";

export default function RestartSeasonButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm("Restart the season?\n\nEvery game reverts to unplayed (results, stats, standings wiped), playoffs cleared, conditions/injuries reset. The SCHEDULE is kept. Rosters are left as-is. This cannot be undone.")) return;
          start(async () => {
            try {
              const r = await restartSeasonAction();
              setMsg(`Season restarted — ${r.games} games back to SCHEDULED. Sim day 1 whenever you're ready.`);
            } catch (e) {
              setMsg(friendlyActionError(e));
            }
          });
        }}
        className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 font-semibold text-sm whitespace-nowrap"
      >
        {pending ? "Restarting…" : "Restart season (keep schedule)"}
      </button>
      {msg && <span className="text-xs text-rose-300 max-w-xs text-right">{msg}</span>}
    </div>
  );
}
