"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importCoachSalariesAction } from "@/app/admin/finance/actions";

export default function CoachImportButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = () => start(async () => {
    setMsg(null);
    const r = await importCoachSalariesAction();
    if (!r.ok) { setMsg(r.error ?? "Failed."); return; }
    setMsg(`Imported ${r.linked} coach salaries (NHL + AHL).`);
    router.refresh();
  });

  return (
    <div className="flex items-center gap-3">
      <button onClick={run} disabled={pending}
        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold">
        {pending ? "Importing…" : "Import coach salaries (profinhl.cz)"}
      </button>
      {msg && <span className="text-sm text-emerald-300">{msg}</span>}
    </div>
  );
}
