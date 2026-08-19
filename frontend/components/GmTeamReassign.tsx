"use client";

import { useMemo, useState, useTransition } from "react";
import { reassignGmTeamAction } from "@/app/admin/dashboard/actions";

type Row = { id: number; name: string; gmNickname: string | null; hasGm: boolean };

/** Commissioner tool: move an active GM's login to a different club (swaps if the
 *  destination already has a GM). The roster stays with the team — only the manager
 *  controlling it changes. */
export default function GmTeamReassign({ teams }: { teams: Row[] }) {
  const [rows, setRows] = useState(teams);
  const managed = useMemo(() => rows.filter((t) => t.hasGm).sort((a, b) => a.name.localeCompare(b.name)), [rows]);
  const [from, setFrom] = useState<number | "">("");
  const [to, setTo] = useState<number | "">("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const move = () => {
    if (from === "" || to === "") return;
    start(async () => {
      setMsg(null);
      const r = await reassignGmTeamAction(Number(from), Number(to));
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      // reflect: destination now has a GM; source has one only if this was a swap
      setRows((rs) => rs.map((t) =>
        t.id === Number(to) ? { ...t, hasGm: true }
        : t.id === Number(from) ? { ...t, hasGm: !!r.swapped }
        : t));
      setMsg({ ok: true, text: r.swapped ? `Swapped GMs: ${r.from} ↔ ${r.to}.` : `Moved GM: ${r.from} → ${r.to}.` });
      setFrom(""); setTo("");
    });
  };

  const destOccupied = to !== "" && rows.find((t) => t.id === Number(to))?.hasGm;

  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">Move a manager to a different franchise. The roster, cap and history stay with the club — only the login moves. If the destination already has a GM, the two are <b>swapped</b>.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">GM currently at</span>
          <select value={from} onChange={(e) => setFrom(e.target.value ? Number(e.target.value) : "")} disabled={pending}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm min-w-[200px]">
            <option value="">— select a GM —</option>
            {managed.map((t) => <option key={t.id} value={t.id}>{t.name}{t.gmNickname ? ` · ${t.gmNickname}` : ""}</option>)}
          </select>
        </label>
        <span className="pb-2 text-slate-500">→</span>
        <label className="text-sm">
          <span className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">Move to</span>
          <select value={to} onChange={(e) => setTo(e.target.value ? Number(e.target.value) : "")} disabled={pending}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm min-w-[200px]">
            <option value="">— select a team —</option>
            {rows.filter((t) => t.id !== from).sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.hasGm ? " (has GM — will swap)" : ""}</option>
            ))}
          </select>
        </label>
        <button onClick={move} disabled={pending || from === "" || to === ""}
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold disabled:opacity-50">
          {pending ? "Moving…" : destOccupied ? "Swap" : "Move"}
        </button>
      </div>
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</p>}
    </div>
  );
}
