import Link from "next/link";
import { PageHeader, Card, StatTile } from "@/components/ui";
import { verifyIntegrity, type IntegrityIssue } from "@/lib/integrity-server";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

function IssueList({ items, empty }: { items: IntegrityIssue[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-emerald-400">✓ {empty}</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((i) => (
        <li key={i.gameId} className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-3 py-2">
          <Link href={`/games/${i.gameId}`} className="font-semibold text-rose-200 hover:underline">{i.label}</Link>
          <span className="text-rose-300/80"> — {i.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function IntegrityPage() {
  const lang = await getLang();
  const T = (en: string, sk: string) => (lang === "cs" ? sk : en);
  const r = await verifyIntegrity();

  const problems = (r.chain.ok ? 0 : 1) + r.games.unsealed.length + r.games.edited.length + r.consistency.mismatches.length;
  const allGood = problems === 0;

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={T("Result Integrity", "Integrita výsledkov")}
        subtitle={T(
          "Every result comes straight out of the simulator. It can't be planned in advance and can't be edited afterwards without being caught.",
          "Každý výsledok pochádza priamo zo simulátora. Nedá sa vopred naplánovať a nedá sa dodatočne upraviť bez toho, aby sa to prezradilo.",
        )}
      />

      <div className={`rounded-2xl border p-5 ${allGood ? "border-emerald-700/50 bg-emerald-950/20" : "border-rose-700/60 bg-rose-950/30"}`}>
        <div className={`text-lg font-black ${allGood ? "text-emerald-300" : "text-rose-300"}`}>
          {allGood
            ? T("✅ All results verified", "✅ Všetky výsledky sú overené")
            : T(`⚠ ${problems} integrity problem${problems === 1 ? "" : "s"} found`, `⚠ Nájdených problémov s integritou: ${problems}`)}
        </div>
        <p className="mt-1 text-sm text-slate-300">
          {T(
            `Checked just now: ${r.games.verified} of ${r.games.final} finished games match their seal, the hash chain has ${r.chain.entries} entries.`,
            `Práve skontrolované: ${r.games.verified} z ${r.games.final} odohraných zápasov sedí s pečaťou, reťazec má ${r.chain.entries} záznamov.`,
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label={T("Verified results", "Overené výsledky")} value={`${r.games.verified}/${r.games.final}`} color={r.games.verified === r.games.final ? "text-emerald-400" : "text-rose-400"} />
        <StatTile label={T("Random seed at sim time", "Náhodný seed pri simulácii")} value={r.games.csprng} sub={T("sealed live", "zapečatené naživo")} />
        <StatTile label={T("Legacy (sealed as-is)", "Staršie (zapečatené ako boli)")} value={r.games.legacy} sub={r.chain.genesisAt ? T(`sealed ${r.chain.genesisAt.slice(0, 10)}`, `zapečatené ${r.chain.genesisAt.slice(0, 10)}`) : undefined} />
        <StatTile label={T("Re-simulated games", "Opakovane simulované zápasy")} value={r.resims.games} color={r.resims.games ? "text-amber-400" : "text-white"} />
      </div>

      {r.games.noContest > 0 && (
        <p className="text-xs text-slate-500">
          {T(`${r.games.noContest} game(s) were declared 0–0 no-contests because a roster could not be loaded (no simulation ran); they are sealed as such.`,
             `${r.games.noContest} zápas(ov) bolo vyhlásených za kontumačné 0–0, lebo sa nedala načítať súpiska (simulácia nebežala); sú zapečatené ako také.`)}
        </p>
      )}

      <Card title={T("How results are produced", "Ako vznikajú výsledky")} accent="text-sky-400">
        <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-300">
          <li>
            <b>{T("Only the simulator decides.", "Rozhoduje iba simulátor.")}</b>{" "}
            {T("The score, shots, goals and player stats are all produced by the simulation engine from the rosters and lines on ice. There is no feature anywhere on the site to enter or set a result.",
               "Skóre, strely, góly aj štatistiky hráčov vytvára simulačný engine zo súpisiek a lajn na ľade. Nikde na webe nie je funkcia, ktorou by sa výsledok zadal alebo nastavil.")}
          </li>
          <li>
            <b>{T("The seed is random and unknown in advance.", "Seed je náhodný a vopred neznámy.")}</b>{" "}
            {T("At the moment a game is simulated the server draws a fresh seed from the operating system's cryptographic random generator. It is not derived from the teams, the date, the game number or anything else, so nobody — not the commissioner, not a developer — can know or pre-compute the outcome before the game is played.",
               "V momente simulácie zápasu server vylosuje nový seed z kryptografického generátora náhodných čísel operačného systému. Neodvodzuje sa od tímov, dátumu, čísla zápasu ani ničoho iného, takže výsledok nevie vopred zistiť ani vypočítať nikto — ani komisár, ani vývojár.")}
          </li>
          <li>
            <b>{T("Every result is sealed.", "Každý výsledok sa zapečatí.")}</b>{" "}
            {T("In the same database transaction that saves the game, its full result (score, goals by period, shots, winner, goal log, seed, engine version) is hashed with SHA-256 and chained to the previous seal. Changing any stored result or seal afterwards breaks the chain or the match below.",
               "V tej istej databázovej transakcii, ktorá zápas uloží, sa jeho kompletný výsledok (skóre, góly po tretinách, strely, víťaz, zoznam gólov, seed, verzia enginu) zahašuje pomocou SHA-256 a naviaže na predchádzajúcu pečať. Akákoľvek dodatočná zmena uloženého výsledku alebo pečate preruší reťazec alebo zhodu nižšie.")}
          </li>
          <li>
            <b>{T("Anyone can check.", "Overiť to môže ktokoľvek.")}</b>{" "}
            {T("This page recomputes everything from the live database on every visit. The chain head is also posted once a day as a league-news line, so rewriting history is visible too.",
               "Táto stránka pri každej návšteve všetko prepočíta z aktuálnej databázy. Hlavička reťazca sa navyše raz denne zverejní ako správa v League News, takže aj prepisovanie histórie by bolo vidno.")}
          </li>
        </ol>
        <p className="mt-3 text-[11px] text-slate-500 font-mono break-all">
          hash = SHA-256( prevHash | resultDigest | gameId | seed | engine | source | sealedAt )
        </p>
      </Card>

      <Card title={T("Checks", "Kontroly")} accent="text-violet-300">
        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">{T("Hash chain", "Reťazec hashov")}</h3>
            {r.chain.ok
              ? <p className="text-sm text-emerald-400">✓ {T(`All ${r.chain.entries} entries link correctly.`, `Všetkých ${r.chain.entries} záznamov na seba správne nadväzuje.`)}</p>
              : <p className="text-sm text-rose-300">⚠ {T(`Chain broken at seal #${r.chain.brokenAtSealId}.`, `Reťazec je prerušený pri pečati #${r.chain.brokenAtSealId}.`)}</p>}
            {r.chain.head && <p className="mt-1 text-[11px] text-slate-500 font-mono break-all">{T("Chain head", "Hlavička reťazca")}: {r.chain.head}</p>}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">{T("Results edited after sealing", "Výsledky upravené po zapečatení")}</h3>
            <IssueList items={r.games.edited} empty={T("No stored result differs from its seal.", "Žiadny uložený výsledok sa nelíši od svojej pečate.")} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">{T("Results without a simulator seal", "Výsledky bez pečate zo simulátora")}</h3>
            <IssueList items={r.games.unsealed} empty={T("Every finished game carries a seal.", "Každý odohraný zápas má pečať.")} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">{T("Score vs. goal log vs. box scores", "Skóre vs. zoznam gólov vs. štatistiky hráčov")}</h3>
            <IssueList items={r.consistency.mismatches} empty={T(`All ${r.consistency.checked} games are internally consistent.`, `Všetkých ${r.consistency.checked} zápasov je vnútorne konzistentných.`)} />
          </div>
          {r.resims.list.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-amber-400 mb-1.5">{T("Re-simulated games (always disclosed)", "Opakovane simulované zápasy (vždy zverejnené)")}</h3>
              <ul className="space-y-1 text-sm text-amber-200/90">
                {r.resims.list.map((i) => <li key={i.gameId}><Link href={`/games/${i.gameId}`} className="hover:underline">{i.label}</Link> — {i.detail}</li>)}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <Card title={T("Latest seals", "Posledné pečate")} accent="text-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                <th className="text-left px-2 py-1.5">{T("Game", "Zápas")}</th>
                <th className="text-left px-2 py-1.5">Seed</th>
                <th className="text-left px-2 py-1.5">{T("Source", "Zdroj")}</th>
                <th className="text-left px-2 py-1.5">Hash</th>
              </tr>
            </thead>
            <tbody>
              {r.recent.map((s) => (
                <tr key={s.hash} className="border-b border-slate-800/50">
                  <td className="px-2 py-1.5"><Link href={`/games/${s.gameId}`} className="hover:text-blue-400">{s.label}</Link></td>
                  <td className="px-2 py-1.5 font-mono tabular-nums text-slate-300">{s.seed ?? "—"}</td>
                  <td className="px-2 py-1.5 text-slate-400">{s.seedSource === "CSPRNG" ? T("random at sim time", "náhodný pri simulácii") : T("legacy", "staršie")}</td>
                  <td className="px-2 py-1.5 font-mono text-[11px] text-slate-500">{s.hash.slice(0, 16)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          {T("See also the ", "Pozri aj ")}<Link href="/league/audit" className="text-sky-400 hover:underline">{T("League Audit Log", "League Audit Log")}</Link>
          {T(" — who ran each simulation.", " — kto ktorú simuláciu spustil.")}
        </p>
      </Card>
    </div>
  );
}
