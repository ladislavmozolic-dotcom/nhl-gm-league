"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminTransferPlayer } from "@/app/admin/roster-moves/actions";

export default function AdminTransferButton({ playerId, playerName, toTeamId, toTeamName }: { playerId: number; playerName: string; toTeamId: number; toTeamName: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`Move ${playerName} to ${toTeamName}? This bypasses the trade system entirely — no consent, no cap check.`)) return;
        start(async () => {
          const r = await adminTransferPlayer(playerId, toTeamId);
          if (!r.ok) { alert(r.error); return; }
          router.refresh();
        });
      }}
      className="text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-blue-600 text-slate-200 font-semibold disabled:opacity-40 whitespace-nowrap"
    >
      {pending ? "…" : `→ ${toTeamName}`}
    </button>
  );
}
