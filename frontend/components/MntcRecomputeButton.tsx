"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { recomputeMntcListsAction } from "@/app/admin/fa-tuning/actions";

export default function MntcRecomputeButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [ok, setOk] = useState(true);

  const run = () => start(async () => {
    setResult(null);
    const r = await recomputeMntcListsAction();
    if (!r.ok) { setOk(false); setResult(r.error); return; }
    setOk(true);
    setResult(`Re-rolled the M-NTC lists: ${r.changed} of ${r.total} players updated.`);
  });

  return (
    <Card title="M-NTC lists — re-roll by roster strength" accent="text-amber-400">
      <p className="text-xs text-slate-500 mb-3">
        Replaces every existing M-NTC &quot;won&apos;t go there&quot; list (current deals and signed extensions) with the
        weakest clubs by roster strength — the same rule new signings use — keeping each list&apos;s own length.
        Fixes lists that were frozen from early-season standings. Safe to run again; it is logged below.
      </p>
      <button onClick={run} disabled={pending}
        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold disabled:opacity-50">
        {pending ? "Re-rolling…" : "Re-roll all M-NTC lists"}
      </button>
      {result && <p className={`mt-2 text-sm ${ok ? "text-emerald-400" : "text-rose-400"}`}>{result}</p>}
    </Card>
  );
}
