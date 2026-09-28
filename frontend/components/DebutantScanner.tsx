"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scanAndSyncDebutantsAction } from "@/app/tools/player-calculator/actions";
import type { ScanAndSyncResult } from "@/lib/rookie-debutants";

/** Admin tool: on click, scans all 32 real NHL rosters for players with NO Player
 *  row in our database at all who have already logged a real NHL game this
 *  season, creates a Player row for every one of them automatically (rosterType
 *  PROSPECT — no manual per-player review, since a real GP > 0 already means
 *  he's worth tracking), refreshes current-season stats for the WHOLE league,
 *  and finally triggers a Live Calculator recompute (the same engine every other
 *  player's rating comes from) so everyone's Player.liveCalculatorRatings blob —
 *  new debutants and anyone already sitting in a PROSPECT pool from an earlier
 *  scan alike — is fresh. Everything then shows up in the "Prospekti s reálnymi
 *  zápasmi" table below right away (router.refresh()) — it does NOT touch the
 *  separate Prospect (scouting) table, so a "Už v prospektoch" tag just means
 *  he's also scouted there, not a duplicate. */
export default function DebutantScanner() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ScanAndSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = () => start(async () => {
    setError(null);
    const r = await scanAndSyncDebutantsAction();
    if (!r.ok) { setError(r.error ?? "Zlyhalo."); setResult(null); return; }
    setResult(r);
    router.refresh();
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={scan} disabled={pending}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold">
          {pending ? "Skenujem 32 tímov, obnovujem štatistiky a prepočítavam ratingy…" : "Skenovať reálne NHL rostre"}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
      {result && (
        <div className="text-sm space-y-2">
          <p className="text-slate-400">
            Štatistiky obnovené u <b className="text-slate-200">{result.statsRefreshed}</b> hráčov, ratingy prepočítané cez Live
            Calculator engine u <b className="text-slate-200">{result.ratingsRecomputed}</b> hráčov (vrátane už skôr založených
            prospektov nižšie).
          </p>
          {result.created.length === 0 ? (
            <p className="text-slate-500">Žiadny nový reálny NHL debutant sa nenašiel — všetci s odohratým zápasom už u nás majú Player záznam.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 520 }}>
                <thead>
                  <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-2 text-left">Novo založený</th>
                    <th className="px-2 py-2">Team</th>
                    <th className="px-2 py-2">GP</th>
                    <th className="px-2 py-2">Prospect pool?</th>
                    <th className="px-2 py-2 text-left">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {result.created.map((c) => (
                    <tr key={c.name} className="border-b border-slate-800/40">
                      <td className="px-3 py-1.5 font-medium">{c.name}</td>
                      <td className="px-2 py-1.5 text-center text-slate-400">{c.teamAbbrev}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{c.gp}</td>
                      <td className="px-2 py-1.5 text-center">
                        {c.alreadyProspect
                          ? <span className="text-amber-300 text-xs">Áno ({c.prospectTeamCode})</span>
                          : <span className="text-slate-600 text-xs">Nie — nikde</span>}
                      </td>
                      <td className="px-2 py-1.5 text-xs">
                        {c.error
                          ? <span className="text-red-400">{c.error}</span>
                          : c.isGoalie
                            ? <span className="text-amber-300">Založený — brankári zatiaľ nie sú v Rookie Calculatore podporovaní</span>
                            : <span className="text-green-400">Založený ✓, pridaný do tabuľky nižšie</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
