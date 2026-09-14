"use client";

import { useState, useTransition } from "react";
import { resolveStructuredCondition } from "@/app/admin/conditions/actions";

export default function ResolveConditionButton({ conditionId }: { conditionId: number }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const go = () => start(async () => {
    setConfirm(false);
    const r = await resolveStructuredCondition(conditionId);
    setMsg(r.ok ? (r.met ? "Resolved — condition MET, pick swapped." : "Resolved — condition NOT met, no change.") : r.error);
  });

  if (msg) return <p className="text-xs text-slate-400 mt-1">{msg}</p>;
  return confirm ? (
    <span className="flex items-center gap-1.5 mt-1">
      <span className="text-xs text-amber-300">Resolve now, based on stats as they stand today?</span>
      <button onClick={go} disabled={pending} className="text-xs px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-50">{pending ? "…" : "Confirm"}</button>
      <button onClick={() => setConfirm(false)} className="text-xs px-2 py-1 rounded-lg bg-slate-700">Cancel</button>
    </span>
  ) : (
    <button onClick={() => setConfirm(true)} className="mt-1 text-xs px-3 py-1.5 rounded-lg bg-amber-900/40 border border-amber-800/50 hover:bg-amber-900/60 text-amber-300 font-semibold">
      Resolve now
    </button>
  );
}
