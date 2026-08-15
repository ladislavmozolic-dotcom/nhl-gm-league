"use client";

import { useState, useTransition } from "react";
import { cleanName } from "@/lib/playerName";
import { refreshAhlGpAction, applyReconcileOneAction, applyAllReconcileAction } from "@/app/admin/roster-update/actions";

type Row = {
  id: number; name: string; teamCode: string | null; age: number | null; rosterType: string | null;
  nhlGP: number; ahlGP: number; capHit: number | null; action: string; reason: string;
};

const ACTION_META: Record<string, { label: string; cls: string }> = {
  ACTIVATE_NHL: { label: "Activate → NHL", cls: "text-green-400" },
  ACTIVATE_NHL_ELC: { label: "Prospect → NHL (ELC)", cls: "text-emerald-400" },
  ACTIVATE_AHL: { label: "Prospect → AHL ($100k)", cls: "text-teal-400" },
  LTIR_PROSPECT: { label: "→ LTIR reserve (off cap)", cls: "text-amber-400" },
  TO_PROSPECTS: { label: "→ Prospects", cls: "text-blue-400" },
  DELETE: { label: "Release", cls: "text-red-400" },
};

export default function RosterReconcile({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());

  const refresh = () => start(async () => {
    const r = await refreshAhlGpAction();
    setMsg(r.ok ? `AHL GP refreshed — matched ${r.matched}/${r.total}. Reload to recompute.` : r.error);
  });
  const applyOne = (id: number) => start(async () => {
    const r = await applyReconcileOneAction(id);
    if (r.ok) setDone((s) => new Set(s).add(id));
    else setMsg(r.error ?? "Failed.");
  });
  const applyAll = () => start(async () => {
    const r = await applyAllReconcileAction();
    setMsg(r.ok ? `✓ Applied ${r.applied} roster moves.` : r.error);
    if (r.ok) setDone(new Set(rows.map((x) => x.id)));
  });

  const counts = rows.reduce((m, r) => ((m[r.action] = (m[r.action] ?? 0) + 1), m), {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={refresh} disabled={pending} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold">
          {pending ? "…" : "⟳ Refresh AHL GP"}
        </button>
        {rows.length > 0 && (
          <button onClick={applyAll} disabled={pending} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-sm font-semibold">
            {pending ? "Applying…" : `Apply all ${rows.length} moves`}
          </button>
        )}
        <span className="text-xs text-slate-500">
          {Object.entries(counts).map(([a, n]) => <span key={a} className={`mr-3 ${ACTION_META[a]?.cls}`}>{ACTION_META[a]?.label ?? a} {n}</span>)}
        </span>
        {msg && <span className="text-sm text-green-300">{msg}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 760 }}>
          <thead>
            <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left">Player</th><th className="px-2 py-2">Team</th><th className="px-2 py-2">Age</th><th className="px-2 py-2">From</th>
              <th className="px-2 py-2">NHL GP</th><th className="px-2 py-2">AHL GP</th><th className="px-3 py-2 text-left">Action</th><th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                <td className="px-3 py-1.5 font-medium">{cleanName(r.name)}</td>
                <td className="px-2 py-1.5 text-center text-slate-400">{r.teamCode}</td>
                <td className="px-2 py-1.5 text-center tabular-nums">{r.age}</td>
                <td className="px-2 py-1.5 text-center text-slate-500">{r.rosterType}</td>
                <td className="px-2 py-1.5 text-center tabular-nums">{r.nhlGP}</td>
                <td className="px-2 py-1.5 text-center tabular-nums">{r.ahlGP}</td>
                <td className="px-3 py-1.5">
                  <span className={`font-semibold ${ACTION_META[r.action]?.cls}`}>{ACTION_META[r.action]?.label ?? r.action}</span>
                  <span className="block text-[11px] text-slate-500">{r.reason}</span>
                </td>
                <td className="px-2 py-1.5 text-right">
                  {done.has(r.id) ? <span className="text-xs text-green-400">✓</span> :
                    <button onClick={() => applyOne(r.id)} disabled={pending} className="px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-xs font-semibold disabled:opacity-50">Apply</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No roster moves needed — everyone is correctly placed.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
