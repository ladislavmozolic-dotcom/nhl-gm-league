"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { bulkImportFaOverridesAction } from "@/app/admin/fa-tuning/actions";

export default function FaBulkImportButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const run = () => start(async () => {
    setResult(null);
    const r = await bulkImportFaOverridesAction();
    if (!r.ok) { setResult(r.error); return; }
    setResult(`Applied ${r.applied} player ladders.${r.skipped.length ? ` Skipped: ${r.skipped.join(", ")}` : ""}`);
  });

  return (
    <Card title="Bulk import — Smlouvy.xlsx (FA 2027)" accent="text-amber-400">
      <p className="text-xs text-slate-500 mb-3">
        Applies the 70 hand-set 1-4yr demand ladders from the FA 2027 sheet you sent, matched to
        players by name. Each write is logged below just like a manual override — safe to run
        again if you update the sheet (it just re-applies the same values).
      </p>
      <button onClick={run} disabled={pending}
        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold disabled:opacity-50">
        {pending ? "Applying…" : "Apply 70 player ladders"}
      </button>
      {result && <p className="mt-2 text-sm text-emerald-400">{result}</p>}
    </Card>
  );
}
