"use client";

import { useState, useTransition } from "react";
import { scanMissingNhlPlayersAction, createDebutantAction } from "@/app/tools/player-calculator/actions";
import type { DebutantCandidate } from "@/lib/rookie-debutants";

/** Admin tool: on click, scans all 32 real NHL rosters for players with NO Player
 *  row in our database at all (not even as a prospect) and lets the admin create
 *  one, parked in his real club's prospect pool, so he can pick up a real rating
 *  through the normal Rookie Calculator flow once his stats start importing. */
export default function DebutantScanner() {
  const [pending, start] = useTransition();
  const [candidates, setCandidates] = useState<DebutantCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Record<number, boolean>>({});

  const scan = () => start(async () => {
    setError(null);
    const r = await scanMissingNhlPlayersAction();
    if (!r.ok) { setError(r.error ?? "Zlyhalo."); setCandidates([]); return; }
    setCandidates(r.candidates);
  });

  const create = (c: DebutantCandidate) => start(async () => {
    const r = await createDebutantAction(c);
    if (r.ok) setCreated((s) => ({ ...s, [c.nhlId]: true }));
    else setError(r.error ?? "Zlyhalo.");
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={scan} disabled={pending}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold">
          {pending && candidates == null ? "Skenujem 32 tímov…" : "Skenovať reálne NHL rostre"}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
      {candidates != null && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 700 }}>
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-2 py-2">Team</th>
                <th className="px-2 py-2">Pos</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.nhlId} className="border-b border-slate-800/40">
                  <td className="px-3 py-1.5 font-medium">{c.name}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{c.teamAbbrev}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{c.position}</td>
                  <td className="px-2 py-1.5 text-right">
                    {created[c.nhlId]
                      ? <span className="text-xs text-green-400 font-semibold">Created ✓</span>
                      : (
                        <button onClick={() => create(c)} disabled={pending}
                          className="px-3 py-1 rounded-md bg-green-600/80 hover:bg-green-500 text-white text-xs font-semibold disabled:opacity-50">
                          Create as prospect
                        </button>
                      )}
                  </td>
                </tr>
              ))}
              {candidates.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Žiadny reálny NHL hráč nechýba v našej databáze.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
