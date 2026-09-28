"use client";

import { Fragment, useState, useTransition } from "react";
import { scanMissingNhlPlayersAction, createDebutantAction, previewDebutantAction } from "@/app/tools/player-calculator/actions";
import type { DebutantCandidate } from "@/lib/rookie-debutants";

const PARAM_COLS = ["CK", "FG", "DI", "SK", "ST", "EN", "DU", "PH", "FO", "PA", "SC", "DF", "PS", "EX", "LD", "OV"];

type PreviewState = { loading?: boolean; ratings?: Record<string, number>; error?: string };

/** Admin tool: on click, scans all 32 real NHL rosters for players with NO Player
 *  row in our database at all who have already logged a real NHL game this
 *  season. "Náhľad" computes his full Next Gen rating against the REAL live
 *  population WITHOUT writing anything — a true dry run, so you can see his
 *  parameters before deciding to create him. "Založiť hráča" then creates a
 *  Player row (rosterType PROSPECT) so he can pick up that same real rating
 *  through the Rookie Calculator table above once his stats import — it does NOT
 *  touch the separate Prospect (scouting) table, so a "Už v prospektoch" tag just
 *  means he's also scouted there, not a duplicate. */
export default function DebutantScanner() {
  const [pending, start] = useTransition();
  const [candidates, setCandidates] = useState<DebutantCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Record<number, { gp?: number }>>({});
  const [previews, setPreviews] = useState<Record<number, PreviewState>>({});

  const scan = () => start(async () => {
    setError(null);
    const r = await scanMissingNhlPlayersAction();
    if (!r.ok) { setError(r.error ?? "Zlyhalo."); setCandidates([]); return; }
    setCandidates(r.candidates);
  });

  const preview = (c: DebutantCandidate) => {
    setPreviews((s) => ({ ...s, [c.nhlId]: { loading: true } }));
    start(async () => {
      const r = await previewDebutantAction(c);
      setPreviews((s) => ({ ...s, [c.nhlId]: r.ok ? { ratings: r.ratings } : { error: r.error ?? "Zlyhalo." } }));
    });
  };

  const create = (c: DebutantCandidate) => start(async () => {
    const r = await createDebutantAction(c);
    if (r.ok) setCreated((s) => ({ ...s, [c.nhlId]: { gp: r.statsGP } }));
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
          <table className="w-full text-sm" style={{ minWidth: 820 }}>
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-2 py-2">Team</th>
                <th className="px-2 py-2">Pos</th>
                <th className="px-2 py-2">GP</th>
                <th className="px-2 py-2">Prospect pool?</th>
                <th className="px-2 py-2"></th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const pv = previews[c.nhlId];
                return (
                  <Fragment key={c.nhlId}>
                    <tr className="border-b border-slate-800/40">
                      <td className="px-3 py-1.5 font-medium">{c.name}</td>
                      <td className="px-2 py-1.5 text-center text-slate-400">{c.teamAbbrev}</td>
                      <td className="px-2 py-1.5 text-center text-slate-400">{c.position}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{c.gp}</td>
                      <td className="px-2 py-1.5 text-center">
                        {c.alreadyProspect
                          ? <span className="text-amber-300 text-xs">Áno ({c.prospectTeamCode})</span>
                          : <span className="text-slate-600 text-xs">Nie — nikde</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button onClick={() => preview(c)} disabled={pending}
                          className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold disabled:opacity-50">
                          {pv?.loading ? "…" : "Náhľad"}
                        </button>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {created[c.nhlId]
                          ? (
                            <span className="text-xs text-green-400 font-semibold">
                              Založený ✓{created[c.nhlId].gp != null ? ` (${created[c.nhlId].gp} GP)` : ""}
                            </span>
                          )
                          : (
                            <button onClick={() => create(c)} disabled={pending}
                              className="px-3 py-1 rounded-md bg-green-600/80 hover:bg-green-500 text-white text-xs font-semibold disabled:opacity-50">
                              Založiť hráča
                            </button>
                          )}
                      </td>
                    </tr>
                    {pv && !pv.loading && (
                      <tr className="border-b border-slate-800/40 bg-slate-950/60">
                        <td colSpan={7} className="px-3 py-2">
                          {pv.error && <span className="text-xs text-red-400">{pv.error}</span>}
                          {pv.ratings && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                              {PARAM_COLS.map((k) => (
                                <span key={k} className="tabular-nums">
                                  <span className="text-slate-500">{k}</span>{" "}
                                  <span className="text-slate-200 font-semibold">{pv.ratings![k] ?? "—"}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {candidates.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Žiadny reálny NHL hráč s odohratým zápasom nechýba v našej databáze.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
