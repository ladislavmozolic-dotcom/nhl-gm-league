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
          <li>Rovnaká živá logika ako v <b>Parameters / Live Calculatore</b>: hodnotenia sú počítané priamo zo živých údajov (G/60, A/60, xG, xGA, hity, bloky, TOI, Edge speed bursts, vhadzovania a AHL s NHLe) podľa váh a metrík nastavených v <i>Nastavenia &amp; Tuning</i>. Ochrana pred malou vzorkou zápasov (Bayesian shrinkage nováčikovskej vzorky) a nováčikovské mantinely bránia prestreleným číslam pri pár odohraných zápasoch, takže výsledný Overall realisticky leží v rozmedzí <b>OV 46–56</b>.</li>
          <li>Zobrazujú sa len hráči, ktorí sú v <b>prospect poole</b> nejakého tímu (<code>rosterType = PROSPECT</code>), spĺňajú nováčikovský limit (vek do 25 rokov) a už odohrali reálne NHL/AHL zápasy.</li>
          {isAdmin
            ? <li>Každá bunka s hodnotou je <b>editovateľná</b> — ak ti vypočítané číslo pripadá príliš vysoké/nízke (napr. PA/SC z pár zápasov horúcej série), priamo si ho preprav. &quot;Activate rating&quot; potom zapíše presne to, čo je v bunkách, do CK/SC/PA/DF/... polí hráča — nemení jeho rosterType ani tím, len rating.</li>
            : <li>Prihlás sa ako admin, ak chceš rating aj aktivovať alebo upraviť — tu ho zatiaľ len vidíš.</li>}
        </ul>
      </Card>

      {isAdmin && (
        <Card title="Chýbajúci reální NHL hráči — žiadny Player záznam u nás" accent="text-amber-400">
          <p className="text-xs text-slate-500 mb-3">
            Nájde hráčov, ktorí <b>už odohrali aspoň 1 reálny NHL zápas</b> tento sezónny ročník a nemajú u nás vôbec žiadny <code>Player</code> záznam
            (nedraftovaní juniori bez zápasu sa tu preto neukazujú — nemá ich čo hodnotiť), a <b>automaticky ich založí</b> ako <code>Player</code>
            (<code>rosterType = PROSPECT</code>) — bez ďalšieho potvrdzovania po jednom. Zároveň obnoví aktuálne štatistiky pre všetkých hráčov v
            databáze (aj tých založených pri predošlom skenovaní) a spustí prepočet cez Live Calculator engine, takže ratingy v tabuľke nižšie
            sú vždy čerstvé. Stĺpec vo výsledku ukáže, či
            bol hráč predtým aj scoutovaný v <code>Prospect</code> tabuľke niektorého tímu — to nie je duplicita, len iná, ľahšia tabuľka na scouting.
            Skenovanie prejde všetkých 32 reálnych NHL rostrov (chvíľu trvá — preto sa nespúšťa automaticky pri načítaní stránky).
          </p>
          <DebutantScanner />
        </Card>
      )}

      <Card
        title={`Prospekti s reálnymi zápasmi, zatiaľ bez ratingu (${rookies.length})`}
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
                <tr><td colSpan={PARAM_COLS.length + (isAdmin ? 8 : 7)} className="px-4 py-8 text-center text-slate-500">Žiadny prospekt so skutočnými zápasmi zatiaľ nečaká na rating.</td></tr>
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
