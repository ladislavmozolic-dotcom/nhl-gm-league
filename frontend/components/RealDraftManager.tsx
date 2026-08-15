"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importRealDraftAction, deleteRealDraftAction } from "@/app/admin/real-drafts/actions";

export type ImportedYear = { year: number; count: number };

export default function RealDraftManager({ imported }: { imported: ImportedYear[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [year, setYear] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const doImport = (y: number) => start(async () => {
    setMsg(null);
    const r = await importRealDraftAction(y);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: `${y}: imported ${r.inserted} picks${r.unmatched.length ? ` · unmapped clubs: ${r.unmatched.join(", ")}` : ""}.` });
    setYear("");
    router.refresh();
  });
  const remove = (y: number) => start(async () => { await deleteRealDraftAction(y); router.refresh(); });

  const importedSet = new Set(imported.map((i) => i.year));
  const y = parseInt(year, 10);
  const validYear = Number.isInteger(y) && y >= 1979 && y <= 2100;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold text-slate-100">Import a real NHL draft</div>
        <div className="text-xs text-slate-500">Pulls the actual results (who was picked where) from the NHL API and stores them under real-roster Draft History. Re-importing a year refreshes it.</div>
        <div className="flex items-center gap-2">
          <input value={year} onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="e.g. 2019"
            className="w-28 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none" />
          <button onClick={() => doImport(y)} disabled={pending || !validYear}
            className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold px-5 py-2 text-sm">
            {pending ? "Importing…" : "Import"}
          </button>
          <div className="flex flex-wrap gap-1">
            {[2019, 2018, 2017].filter((yr) => !importedSet.has(yr)).map((yr) => (
              <button key={yr} onClick={() => doImport(yr)} disabled={pending} className="text-xs rounded-lg border border-slate-700 bg-slate-800/60 hover:border-slate-500 text-slate-300 px-2.5 py-1">+ {yr}</button>
            ))}
          </div>
        </div>
        {msg && <div className={`text-sm ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</div>}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-300">Stored real drafts</div>
        {imported.length === 0 && <div className="text-sm text-slate-500">None yet.</div>}
        {imported.map((i) => (
          <div key={i.year} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5">
            <span className="font-semibold text-slate-100">{i.year} Entry Draft</span>
            <span className="text-xs text-slate-500">{i.count} picks</span>
            <div className="ml-auto flex items-center gap-3">
              <button onClick={() => doImport(i.year)} disabled={pending} className="text-xs text-slate-300 hover:text-white underline">Refresh</button>
              <button onClick={() => remove(i.year)} disabled={pending} className="text-xs text-rose-400/80 hover:text-rose-300 underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
