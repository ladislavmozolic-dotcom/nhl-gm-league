"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function AdminTransferButton({ id, label, toTeamId, toTeamName, action, confirmVerb = "Move" }: {
  id: number; label: string; toTeamId: number; toTeamName: string;
  action: (id: number, toTeamId: number) => Promise<{ ok: boolean; error?: string }>;
  confirmVerb?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`${confirmVerb} ${label} to ${toTeamName}? This bypasses the trade system entirely — no consent, no cap check.`)) return;
        start(async () => {
          const r = await action(id, toTeamId);
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
