import PlayerLink from "@/components/PlayerLink";
import { Card } from "@/components/ui";
import RookiePromoteButton from "@/components/RookiePromoteButton";
import DebutantScanner from "@/components/DebutantScanner";
import type { RookieRow, CameoRow } from "@/lib/edge-params-server";

const PARAM_COLS = ["CK", "FG", "DI", "SK", "ST", "EN", "DU", "PH", "FO", "PA", "SC", "DF", "PS", "EX", "LD", "OV"];

/**
 * Prospekti (Player.rosterType === "PROSPECT") ktorí už majú reálne zápasy, ale
 * nikdy nedostali vlastný vypočítaný rating — presne opačná skupina než hráči už
 * ohodnotení pri importe (napr. skutoční UFA veteráni), tí sem nepatria.
 */
export default function RookieCalculatorPanel({ rookies, cameo, isAdmin }: { rookies: RookieRow[]; cameo: CameoRow[]; isAdmin: boolean }) {
  return (
    <>
      <Card title="Ako to funguje" accent="text-slate-200">
        <ul className="text-sm text-slate-300 space-y-1 list-disc pl-5">
          <li>Rovnaký engine ako <b>Next Gen Parameters</b> (<code>/tools/edge-calculator</code>) — reálny výkon per-60, percentil voči lige, regresia k priemeru pri malej vzorke, kalibrácia na STHS škálu.</li>
          <li>Zobrazujú sa len hráči, ktorí sú v <b>prospect poole</b> nejakého tímu (<code>rosterType = PROSPECT</code>) a už odohrali reálne NHL/AHL zápasy — teda ešte nemajú vlastný rating, nie hráči už ohodnotení pri importe (napr. skutoční voľní hráči/veteráni).</li>
          {isAdmin
            ? <li>&quot;Activate rating&quot; zapíše vypočítané hodnoty priamo do CK/SC/PA/DF/... polí hráča — nemení jeho rosterType ani tím, len rating.</li>
            : <li>Prihlás sa ako admin, ak chceš rating aj aktivovať — tu ho zatiaľ len vidíš.</li>}
        </ul>
      </Card>

      {isAdmin && (
        <Card title="Chýbajúci reální NHL hráči — žiadny Player záznam u nás" accent="text-amber-400">
          <p className="text-xs text-slate-500 mb-3">
            Zobrazuje len hráčov, ktorí <b>už odohrali aspoň 1 reálny NHL zápas</b> tento sezónny ročník a nemajú u nás vôbec žiadny <code>Player</code> záznam
            (nedraftovaní juniori bez zápasu sa tu preto neukazujú — nemá ich čo hodnotiť). Stĺpec &quot;Prospect pool?&quot; ukazuje, či hráča už
            máme scoutovaného v <code>Prospect</code> tabuľke niektorého tímu — ak áno, <b>nejde o duplicitu</b>: &quot;Založiť hráča&quot; vytvára
            samostatný <code>Player</code> záznam (<code>rosterType = PROSPECT</code>), lebo len ten sa dá reálne ohodnotiť a zaradiť do tabuľky nižšie.
            Skenovanie prejde všetkých 32 reálnych NHL rostrov (chvíľu trvá — preto sa nespúšťa automaticky pri načítaní stránky).
          </p>
          <DebutantScanner />
        </Card>
      )}

      <Card title={`Prospekti s reálnymi zápasmi, zatiaľ bez ratingu (${rookies.length})`} accent="text-green-400">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 980 }}>
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-2 py-2">Pos</th>
                <th className="px-2 py-2">Age</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">GP</th>
                {PARAM_COLS.map((k) => <th key={k} className="px-1.5 py-2 text-right">{k}</th>)}
                {isAdmin && <th className="px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {rookies.map((r) => (
                <tr key={r.playerId} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                  <td className="px-3 py-1.5 font-medium"><PlayerLink id={r.playerId} slug={r.slug} name={r.name} /></td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{r.position}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.age ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{r.source}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.source === "AHL" ? r.ahlGP : (r.curSeasonGP || r.lastSeasonGP)}</td>
                  {PARAM_COLS.map((k) => (
                    <td key={k} className="px-1.5 py-1.5 text-right tabular-nums text-slate-300">{r.ratings[k] ?? "—"}</td>
                  ))}
                  {isAdmin && <td className="px-2 py-1.5 text-right"><RookiePromoteButton playerId={r.playerId} /></td>}
                </tr>
              ))}
              {rookies.length === 0 && (
                <tr><td colSpan={PARAM_COLS.length + (isAdmin ? 6 : 5)} className="px-4 py-8 text-center text-slate-500">Žiadny prospekt so skutočnými zápasmi zatiaľ nečaká na rating.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`Rookies s 5–9 reálnymi NHL zápasmi minulú sezónu (${cameo.length})`} accent="text-blue-400">
        <p className="text-xs text-slate-500 mb-3">Informatívne — každý korčuliar s minimálnou reálnou ochutnávkou NHL minulú sezónu, bez ohľadu na to, kto ho práve vlastní. Nie je to aktivačný zoznam.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 900 }}>
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-2 py-2">Team</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Pos</th>
                <th className="px-2 py-2">Age</th>
                <th className="px-2 py-2">GP</th>
                <th className="px-2 py-2">G</th>
                <th className="px-2 py-2">A</th>
                <th className="px-2 py-2">SC</th>
                <th className="px-2 py-2">PA</th>
                <th className="px-2 py-2">OV</th>
              </tr>
            </thead>
            <tbody>
              {cameo.map((r) => (
                <tr key={r.playerId} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                  <td className="px-3 py-1.5 font-medium"><PlayerLink id={r.playerId} slug={r.slug} name={r.name} /></td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{r.teamCode ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{r.rosterType}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{r.position}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.age ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.lastSeasonGP}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.lastSeasonG}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.lastSeasonA}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.ratings?.SC ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.ratings?.PA ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums font-semibold">{r.ratings?.OV ?? "—"}</td>
                </tr>
              ))}
              {cameo.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Žiadny korčuliar neodohral 5–9 reálnych NHL zápasov minulú sezónu.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
