"use client";

import { useState, useTransition } from "react";
import { setGmRoleAction, setRookieGmAction } from "@/app/admin/dashboard/actions";

type Row = { id: number; name: string; gmRole: string; gmNickname: string | null; rookieGm?: boolean };
const ROLES: [string, string][] = [["gm", "GM"], ["agent", "Agent"], ["co_comish", "Co-Commissioner"], ["comish", "Commissioner"]];

export default function GmRoleManager({ teams }: { teams: Row[] }) {
  const [rows, setRows] = useState(teams);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const set = (id: number, role: string) => start(async () => {
    setMsg(null);
    const r = await setGmRoleAction(id, role);
    if (r.ok) { setRows((rs) => rs.map((t) => (t.id === id ? { ...t, gmRole: role } : t))); setMsg("Saved."); }
    else setMsg(r.error ?? "Failed.");
  });
  const setRookie = (id: number, rookie: boolean) => start(async () => {
    setMsg(null);
    const r = await setRookieGmAction(id, rookie);
    if (r.ok) { setRows((rs) => rs.map((t) => (t.id === id ? { ...t, rookieGm: rookie } : t))); setMsg("Saved."); }
    else setMsg(r.error ?? "Failed.");
  });
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">Commissioner &amp; Co-Commissioner get full admin powers; comish-tier (incl. Agent) get a 1-day free-agency head-start each round.</p>
      <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-800/60">
        {rows.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-1.5">
            <span className="flex-1 truncate text-sm">{t.name}{t.gmNickname ? <span className="text-slate-500"> · {t.gmNickname}</span> : ""}</span>
            <label className="flex items-center gap-1 text-xs text-rose-300 cursor-pointer select-none" title="Rookie GM — his trades need commission approval">
              <input type="checkbox" checked={!!t.rookieGm} onChange={(e) => setRookie(t.id, e.target.checked)} disabled={pending} />
              (R)
            </label>
            <select value={t.gmRole} onChange={(e) => set(t.id, e.target.value)} disabled={pending}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm">
              {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>
      {msg && <p className={`mt-2 text-sm ${msg === "Saved." ? "text-emerald-400" : "text-rose-400"}`}>{msg}</p>}
    </div>
  );
}
