"use client";

import { useState, useTransition } from "react";
import { setAiModeAction } from "@/app/admin/dashboard/actions";

type Row = { id: number; name: string; aiMode: string };

export default function AiModeManager({ teams }: { teams: Row[] }) {
  const [rows, setRows] = useState(teams);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const set = (id: number, mode: string) => start(async () => {
    setMsg(null);
    const r = await setAiModeAction(id, mode);
    if (r.ok) { setRows((rs) => rs.map((t) => (t.id === id ? { ...t, aiMode: mode } : t))); setMsg("Saved."); }
    else setMsg(r.error ?? "Failed.");
  });
  if (!rows.length) return <p className="text-sm text-slate-500">No AI-run clubs — every team has a registered GM.</p>;
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">Only clubs with <b>no registered GM</b> are AI-run. <b>Base</b> = lineups &amp; cap only. <b>Advanced</b> = also negotiates trades with human GMs (accept / decline / counter), protecting stars and its contention window.</p>
      <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-800/60">
        {rows.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-1.5">
            <span className="flex-1 truncate text-sm">{t.name}</span>
            {t.aiMode === "advanced" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40">🤝 trades</span>}
            <select value={t.aiMode} onChange={(e) => set(t.id, e.target.value)} disabled={pending}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm">
              <option value="base">Base AI GM</option>
              <option value="advanced">Advanced AI GM</option>
            </select>
          </div>
        ))}
      </div>
      {msg && <p className={`mt-2 text-sm ${msg === "Saved." ? "text-emerald-400" : "text-rose-400"}`}>{msg}</p>}
    </div>
  );
}
