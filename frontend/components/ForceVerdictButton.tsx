"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { forceArbitrationVerdictAction } from "@/app/admin/agent/actions";
import { friendlyActionError } from "@/lib/client/action-error";

export default function ForceVerdictButton({ caseId, name }: { caseId: number; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = () => {
    if (!confirm(`Force the arbitration verdict for ${name} now (without waiting 48 h)?`)) return;
    setMsg(null);
    start(async () => {
      try {
        const r = await forceArbitrationVerdictAction(caseId);
        if (!r.ok) setMsg(r.error ?? "Failed"); else router.refresh();
      } catch (e) { setMsg(friendlyActionError(e)); }
    });
  };
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button disabled={pending} onClick={run} className="px-3 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shadow-sm transition">{pending ? "Rozhodujem…" : "Verdikt teraz"}</button>
      {msg && <span className="text-[10px] text-rose-400 font-medium">{msg}</span>}
    </span>
  );
}
