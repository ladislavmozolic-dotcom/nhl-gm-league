"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importCoachSalariesAction, importRetentionsAction } from "@/app/admin/finance/actions";

type Kind = "coaches" | "retentions";

/** Admin button that pulls coach salaries or salary retentions from profinhl.cz. */
export default function CoachImportButton({ kind = "coaches" }: { kind?: Kind }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = () => start(async () => {
    setMsg(null);
    const r = kind === "coaches" ? await importCoachSalariesAction() : await importRetentionsAction();
    if (!r.ok) { setMsg(r.error ?? "Failed."); return; }
    setMsg(kind === "coaches"
      ? `Imported ${(r as { linked: number }).linked} coach salaries (NHL + AHL).`
      : `Applied ${(r as { applied: number }).applied} retention(s)${(r as { names: string[] }).names.length ? ": " + (r as { names: string[] }).names.join(", ") : " — no active retained players on profinhl right now"}.`);
    router.refresh();
  });

  return (
    <div className="flex items-center gap-3">
      <button onClick={run} disabled={pending}
        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold">
        {pending ? "Importing…" : kind === "coaches" ? "Import coach salaries (profinhl.cz)" : "Import salary retentions (profinhl.cz)"}
      </button>
      {msg && <span className="text-sm text-emerald-300">{msg}</span>}
    </div>
  );
}
