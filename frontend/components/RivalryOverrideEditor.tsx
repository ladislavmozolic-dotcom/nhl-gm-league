"use client";

import { useState, useTransition } from "react";
import { setRivalryOverride } from "@/app/teams/[slug]/rivals/actions";

type T = { id: number; name: string; code: string | null; logoUrl: string | null };

export default function RivalryOverrideEditor({ teamId, teams, initialOverrides }: {
  teamId: number; teams: T[]; initialOverrides: { teamId: number; score: number }[];
}) {
  const [rows, setRows] = useState<Map<number, number>>(new Map(initialOverrides.map((o) => [o.teamId, o.score])));
  const [draftOpp, setDraftOpp] = useState<number | "">("");
  const [draftScore, setDraftScore] = useState(100);
  const [pending, start] = useTransition();

  const byId = new Map(teams.map((t) => [t.id, t]));
  const available = teams.filter((t) => !rows.has(t.id));

  const save = (oppId: number, score: number) => start(async () => {
    const r = await setRivalryOverride(teamId, oppId, score);
    if (r.ok) setRows((m) => new Map(m).set(oppId, score));
  });
  const clear = (oppId: number) => start(async () => {
    const r = await setRivalryOverride(teamId, oppId, null);
    if (r.ok) setRows((m) => { const n = new Map(m); n.delete(oppId); return n; });
  });
  const addDraft = () => {
    if (draftOpp === "") return;
    save(draftOpp, draftScore);
    setDraftOpp("");
    setDraftScore(100);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Commissioner only — forces a pair&apos;s rivalry score (0-100), bypassing the organic history calculation.
        Real history still accrues underneath; clear the override any time to let it run organic again.
      </p>

      {[...rows.entries()].map(([oppId, score]) => {
        const t = byId.get(oppId);
        if (!t) return null;
        return (
          <div key={oppId} className="flex items-center gap-2 bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2">
            {t.logoUrl && <img src={t.logoUrl} alt="" width={20} height={20} className="object-contain shrink-0" />}
            <span className="text-sm flex-1 truncate">{t.name}</span>
            <input type="number" min={0} max={100} value={score} disabled={pending}
              onChange={(e) => setRows((m) => new Map(m).set(oppId, Number(e.target.value)))}
              className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-sm tabular-nums" />
            <button onClick={() => save(oppId, score)} disabled={pending}
              className="px-2.5 py-1 rounded bg-red-600/80 hover:bg-red-500 text-xs font-semibold disabled:opacity-50">Save</button>
            <button onClick={() => clear(oppId)} disabled={pending}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs disabled:opacity-50">Clear</button>
          </div>
        );
      })}

      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <select value={draftOpp} onChange={(e) => setDraftOpp(e.target.value ? Number(e.target.value) : "")}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm flex-1">
            <option value="">— pick a team —</option>
            {available.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input type="number" min={0} max={100} value={draftScore} onChange={(e) => setDraftScore(Number(e.target.value))}
            className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-sm tabular-nums" />
          <button onClick={addDraft} disabled={pending || draftOpp === ""}
            className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-xs font-semibold disabled:opacity-50">Add override</button>
        </div>
      )}
    </div>
  );
}
