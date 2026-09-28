import { Card } from "@/components/ui";
import DebutantScanner from "@/components/DebutantScanner";
import RookieTableRow from "@/components/RookieTableRow";
import type { RookieRow } from "@/lib/edge-params-server";

const PARAM_COLS = ["CK", "FG", "DI", "SK", "ST", "EN", "DU", "PH", "FO", "PA", "SC", "DF", "PS", "EX", "LD", "OV"];

/**
 * Prospekti (Player.rosterType === "PROSPECT") ktorí už majú reálne zápasy, ale
 * nikdy nedostali vlastný vypočítaný rating — presne opačná skupina než hráči už
 * ohodnotení pri importe (napr. skutoční UFA veteráni), tí sem nepatria.
 */
export default function RookieCalculatorPanel({ rookies, isAdmin }: { rookies: RookieRow[]; isAdmin: boolean }) {
  return (
    <>
      <Card title="Ako to funguje" accent="text-slate-200">
        <ul className="text-sm text-slate-300 space-y-1 list-disc pl-5">
          <li>Rovnaký engine ako <b>Next Gen Parameters</b> (<code>/tools/edge-calculator</code>) — reálny výkon per-60, percentil voči lige, regresia k priemeru pri malej vzorke, kalibrácia na STHS škálu, plus dodatočný discount za malú vzorku zápasov.</li>
          <li>Zobrazujú sa len hráči, ktorí sú v <b>prospect poole</b> nejakého tímu (<code>rosterType = PROSPECT</code>) a už odohrali reálne NHL/AHL zápasy — teda ešte nemajú vlastný rating, nie hráči už ohodnotení pri importe (napr. skutoční voľní hráči/veteráni).</li>
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
            databáze (aj tých založených pri predošlom skenovaní), takže sa im live prepočíta rating podľa aktuálnej sezóny. Stĺpec vo výsledku ukáže, či
            bol hráč predtým aj scoutovaný v <code>Prospect</code> tabuľke niektorého tímu — to nie je duplicita, len iná, ľahšia tabuľka na scouting.
            Skenovanie prejde všetkých 32 reálnych NHL rostrov (chvíľu trvá — preto sa nespúšťa automaticky pri načítaní stránky).
          </p>
          <DebutantScanner />
        </Card>
      )}

      <Card title={`Prospekti s reálnymi zápasmi, zatiaľ bez ratingu (${rookies.length})`} accent="text-green-400">
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
    </>
  );
}
