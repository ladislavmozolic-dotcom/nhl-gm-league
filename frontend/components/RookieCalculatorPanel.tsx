"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import DebutantScanner from "@/components/DebutantScanner";
import RookieTableRow from "@/components/RookieTableRow";
import LiveCalculatorConfigModal from "@/components/LiveCalculatorConfigModal";
import type { RookieRow } from "@/lib/edge-params-server";
import type { LiveCalcConfigData } from "@/lib/live-calculator-config";

const PARAM_COLS = ["CK", "FG", "DI", "SK", "ST", "EN", "DU", "PH", "FO", "PA", "SC", "DF", "PS", "EX", "LD", "OV"];

/**
 * Prospekti (Player.rosterType === "PROSPECT") ktorí už majú reálne zápasy, ale
 * nikdy nedostali vlastný vypočítaný rating — presne opačná skupina než hráči už
 * ohodnotení pri importe (napr. skutoční UFA veteráni), tí sem nepatria.
 */
export default function RookieCalculatorPanel({
  rookies,
  isAdmin,
  canManage = false,
  liveConfig,
}: {
  rookies: RookieRow[];
  isAdmin: boolean;
  canManage?: boolean;
  liveConfig: LiveCalcConfigData;
}) {
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const isPermitted = isAdmin || canManage;

  return (
    <>
      <Card title="Ako to funguje" accent="text-slate-200">
        <ul className="text-sm text-slate-300 space-y-1 list-disc pl-5">
          <li>The same live logic as in <b>Parameters / Live Calculator</b>: ratings are computed directly from live data (G/60, A/60, xG, xGA, hits, blocks, TOI, Edge speed bursts, faceoffs and AHL with NHLe) using the weights and metrics set in <i>Settings &amp; Tuning</i>. Small-sample protection (Bayesian shrinkage of the rookie sample) and rookie guard rails prevent inflated numbers after a few games, so the resulting Overall realistically lands in the <b>OV 46–56</b> range.</li>
          <li>Only players who are in some team's <b>prospect pool</b> (<code>rosterType = PROSPECT</code>), meet the rookie limit (age up to 25) and have already played real NHL/AHL games are shown.</li>
          {isAdmin
            ? <li>Every cell with a value is <b>editable</b> — if a computed number looks too high/low (e.g. PA/SC from a few games of a hot streak), just overwrite it. &quot;Activate rating&quot; then writes exactly what is in the cells into the player's CK/SC/PA/DF/... fields — it does not change his rosterType or team, only the rating.</li>
            : <li>Sign in as admin if you also want to activate or edit the rating — for now you can only view it.</li>}
        </ul>
      </Card>

      {isAdmin && (
        <Card title="Missing real NHL players — no Player record here" accent="text-amber-400">
          <p className="text-xs text-slate-500 mb-3">
            Finds players who <b>have already played at least 1 real NHL game</b> this season and have no <code>Player</code> record here at all
            (undrafted juniors without a game are therefore not shown — there is nothing to rate), and <b>automatically creates them</b> as a <code>Player</code>
            (<code>rosterType = PROSPECT</code>) — with no further one-by-one confirmation. It also refreshes current stats for all players in the
            database (including those created in a previous scan) and runs a recompute through the Live Calculator engine, so the ratings in the table below
            are always fresh. A column in the result shows whether
            the player was previously also scouted in some team's <code>Prospect</code> table — that is not a duplicate, just a different, lighter scouting table.
            The scan goes through all 32 real NHL rosters (it takes a moment — so it does not run automatically on page load).
          </p>
          <DebutantScanner />
        </Card>
      )}

      <Card
        title={`Prospects with real games, no rating yet (${rookies.length})`}
        accent="text-green-400"
        right={
          isPermitted ? (
            <button
              onClick={() => setConfigModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white whitespace-nowrap flex items-center gap-1.5 transition border border-slate-700"
            >
              <span>⚙️</span>
              <span>Tuning &amp; Nastavenia</span>
            </button>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 1060 }}>
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-2 py-2">Team</th>
                <th className="px-2 py-2">Pos</th>
                <th className="px-2 py-2">Age</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">GP</th>
                <th className="px-2 py-2">G</th>
                <th className="px-2 py-2">A</th>
                {PARAM_COLS.map((k) => <th key={k} className="px-1.5 py-2 text-right">{k}</th>)}
                {isAdmin && <th className="px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {rookies.map((r) => <RookieTableRow key={r.playerId} row={r} isAdmin={isAdmin} />)}
              {rookies.length === 0 && (
                <tr><td colSpan={PARAM_COLS.length + (isAdmin ? 8 : 7)} className="px-4 py-8 text-center text-slate-500">No prospect with real games is waiting for a rating yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {isPermitted && liveConfig && (
        <LiveCalculatorConfigModal
          isOpen={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
          initialConfig={liveConfig}
          isAdmin={isAdmin}
          canManage={canManage}
          initialTab="weights"
        />
      )}
    </>
  );
}
