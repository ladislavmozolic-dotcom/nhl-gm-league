"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { setTeamClausesAction } from "@/app/teams/[slug]/salary/actions";

type P = { id: number; name: string; position: string; clause: string | null; noTradeTeams: number[] };
type T = { id: number; code: string };

const OPTS: [string, string][] = [["", "None"], ["NTC", "NTC"], ["NMC", "NMC"], ["M_NTC", "M-NTC"]];

export default function ClauseEditor({ teamId, players, teams }: { teamId: number; players: P[]; teams: T[] }) {
  const [rows, setRows] = useState(() => players.map((p) => ({ ...p, clause: p.clause ?? "", noTradeTeams: p.noTradeTeams ?? [] })));
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const setClause = (id: number, clause: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, clause } : r)));
  const toggleTeam = (id: number, tid: number) => setRows((rs) => rs.map((r) => {
    if (r.id !== id) return r;
    const has = r.noTradeTeams.includes(tid);
    return { ...r, noTradeTeams: has ? r.noTradeTeams.filter((x) => x !== tid) : [...r.noTradeTeams, tid] };
  }));

  const save = () => start(async () => {
    setMsg(null);
    try {
      await setTeamClausesAction(teamId, rows.map((r) => ({ playerId: r.id, clause: r.clause || null, noTradeTeams: r.noTradeTeams })));
      setMsg("Saved.");
    } catch (e) { setMsg((e as Error).message); }
  });

  return (
    <Card title="No-Trade / No-Movement Clauses" accent="text-amber-400">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-sm text-blue-400 hover:underline">
          Manage clauses ({rows.filter((r) => r.clause).length} active) →
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">NTC blocks any trade · NMC blocks trade, waivers &amp; demotion · M-NTC blocks trades to the teams you pick. A protected player must waive his clause in the Trade Room to be dealt.</p>
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-800/60">
            {rows.map((r) => (
              <div key={r.id} className="py-2">
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm">{r.name} <span className="text-slate-500 text-xs">{r.position}</span></span>
                  <select value={r.clause} onChange={(e) => setClause(r.id, e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm">
                    {OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {r.clause === "M_NTC" && (
                  <div className="mt-1.5 ml-1 flex flex-wrap gap-1">
                    {teams.filter((t) => t.id !== teamId).map((t) => {
                      const on = r.noTradeTeams.includes(t.id);
                      return (
                        <button key={t.id} type="button" onClick={() => toggleTeam(r.id, t.id)}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${on ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-slate-800/50 text-slate-500 border-slate-700 hover:text-slate-300"}`}>
                          {t.code}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={save} disabled={pending} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold disabled:opacity-40">{pending ? "Saving…" : "Save clauses"}</button>
            <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-200">Close</button>
            {msg && <span className={`text-sm ${msg === "Saved." ? "text-emerald-400" : "text-rose-400"}`}>{msg}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
