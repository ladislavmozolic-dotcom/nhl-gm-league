"use client";

import { useTransition } from "react";
import { removeGmAction } from "@/app/admin/join-requests/actions";

export default function RemoveGmButton({ teamId, gmLabel, teamName }: { teamId: number; gmLabel: string; teamName: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`Remove ${gmLabel} as GM of ${teamName}? He loses login access immediately and the team reverts to AI GM until someone else claims it.`)) return;
        const fd = new FormData();
        fd.set("teamId", String(teamId));
        start(() => removeGmAction(fd));
      }}
      className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-red-600 text-slate-200 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
    >
      {pending ? "…" : "Vymazať GM"}
    </button>
  );
}
