import { notFound } from "next/navigation";
import { intelligenceAccess } from "@/lib/gm-assistant/access";
import { getTeamSession } from "@/lib/auth";
import { cleanName } from "@/lib/playerName";
import { money } from "@/lib/finance";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { parseMoves, runScenario, searchUfaPlayers, listTeamRoster, listNhlTeams } from "@/lib/gm-assistant/scenarioEngine";
import { addSignMoveAction, addWalkMoveAction, addTradeMoveAction, removeMoveAction } from "./actions";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

// UNHL Intelligence — Scenario Engine ("Čo ak?", roadmap Phase 6). Every move
// added below is held only in this page's own URL (?moves=...) and applied to
// an in-memory clone of the real roster/cap/rank state — nothing here ever
// writes to the live league. See lib/gm-assistant/scenarioEngine.ts and
// memory: gm-assistant-intelligence.

const inputCls = "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500";
const labelCls = "block text-xs uppercase tracking-wide text-slate-400 mb-1";

export default async function ScenarioPage({ searchParams }: { searchParams: Promise<{ moves?: string; qsign?: string; partner?: string }> }) {
  const teamId = await getTeamSession();
  if (teamId == null) notFound();
  if (!(await intelligenceAccess()).full) notFound();

  const lang = await getLang();
  const cs = lang === "cs";

  const sp = await searchParams;
  const movesRaw = sp.moves ?? "";
  const moves = parseMoves(movesRaw);
  const qsign = (sp.qsign ?? "").trim();
  const partnerId = Number(sp.partner);

  const [result, myRoster, teams] = await Promise.all([
    runScenario(teamId, moves),
    listTeamRoster(teamId),
    listNhlTeams(),
  ]);
  if (!result) notFound();

  const [signCandidates, partner] = await Promise.all([
    qsign ? searchUfaPlayers(qsign) : Promise.resolve([]),
    Number.isFinite(partnerId) ? Promise.resolve(teams.find((t) => t.id === partnerId)) : Promise.resolve(undefined),
  ]);
  const partnerRoster = partner ? await listTeamRoster(partner.id) : [];

  // Players already committed to a pending move (walked or given away) don't
  // need to show up again as pick-able in the "add a move" forms below.
  const pendingOut = new Set(moves.flatMap((m) => (m.kind === "walk" ? [m.playerId] : m.kind === "trade" ? m.giveIds : [])));
  const availableMine = myRoster.filter((p) => !pendingOut.has(p.id));

  const ratingOf = (p: { isGoalie: boolean; overall: number | null; goalieRating: { overall: number | null } | null }) =>
    p.isGoalie ? p.goalieRating?.overall ?? "?" : p.overall ?? "?";

  return (
    <div className="py-2 flex flex-col gap-6">
      <PageHeader
        title="🧪 Scenario Engine"
        subtitle={cs ? "UNHL Intelligence — „Čo ak?“ simulácia bez zápisu do ligy, kým reálne krok nevykonáš." : "UNHL Intelligence — “What if?” sandboxed simulation without writing to the league."}
        right={<BackPill href="/tools/assistant">UNHL Intelligence</BackPill>}
      />

      <Card title={`${cs ? "Kroky scenára" : "Scenario Moves"} (${result.moves.length})`} accent="text-blue-400">
        {result.moves.length === 0 ? (
          <p className="text-sm text-slate-400">{cs ? "Zatiaľ žiadny krok — pridaj podpis, trade alebo uvoľnenie hráča nižšie." : "No moves yet — add a mock signing, trade or release below."}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {result.moves.map((m, i) => (
              <div key={i} className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 ${m.valid ? "border-slate-800 bg-slate-900/40" : "border-red-900/50 bg-red-950/30"}`}>
                <span className="text-sm text-slate-200">
                  {m.label}
                  {!m.valid && <span className="text-red-400 text-xs ml-2">({m.problem})</span>}
                </span>
                <form action={removeMoveAction}>
                  <input type="hidden" name="currentMoves" value={movesRaw} />
                  <input type="hidden" name="index" value={i} />
                  <button type="submit" className="text-xs text-slate-500 hover:text-red-400 shrink-0">✕ {cs ? "odstrániť" : "remove"}</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title={cs ? "Podpísať voľného agenta" : "Mock Sign UFA"} accent="text-emerald-400">
          <form method="get" className="flex gap-2 mb-3">
            <input type="hidden" name="moves" value={movesRaw} />
            {partner && <input type="hidden" name="partner" value={partner.id} />}
            <input name="qsign" defaultValue={qsign} placeholder={cs ? "Meno hráča…" : "Player name…"} className={inputCls} />
            <button type="submit" className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 shrink-0">{cs ? "Hľadať" : "Search"}</button>
          </form>
          {qsign && signCandidates.length === 0 && <p className="text-xs text-slate-500">{cs ? `Žiadny voľný agent nezodpovedá „${qsign}“.` : `No UFA matches “${qsign}”.`}</p>}
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {signCandidates.map((p) => (
              <form key={p.id} action={addSignMoveAction} className="flex flex-col gap-1.5 border border-slate-800 rounded-lg p-2">
                <input type="hidden" name="currentMoves" value={movesRaw} />
                <input type="hidden" name="playerId" value={p.id} />
                <span className="text-xs text-slate-300">{cleanName(p.name)} <span className="text-slate-500">({p.position}, rating {ratingOf(p)})</span></span>
                <div className="flex items-center gap-1.5">
                  <input name="capHit" type="number" step={50000} min={0} defaultValue={1000000} className="w-24 bg-slate-800 rounded px-1.5 py-1 text-xs text-white" />
                  <span className="text-[11px] text-slate-500">×</span>
                  <input name="years" type="number" min={1} max={8} defaultValue={1} className="w-12 bg-slate-800 rounded px-1.5 py-1 text-xs text-white" />
                  <span className="text-[11px] text-slate-500">{cs ? "r." : "yr"}</span>
                  <button type="submit" className="ml-auto text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold">{cs ? "Pridať" : "Add"}</button>
                </div>
              </form>
            ))}
          </div>
        </Card>

        <Card title={cs ? "Pustiť hráča z kádra" : "Release Player"} accent="text-amber-400">
          <p className="text-xs text-slate-500 mb-2">{cs ? "Zjednodušene: hráč odchádza bez náhrady a bez capu — bez modelu odstupného/buyoutu." : "Simplified: player leaves with zero return and zero dead cap."}</p>
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {availableMine.map((p) => (
              <form key={p.id} action={addWalkMoveAction} className="flex items-center justify-between gap-2">
                <input type="hidden" name="currentMoves" value={movesRaw} />
                <input type="hidden" name="playerId" value={p.id} />
                <span className="text-xs text-slate-300 truncate">{cleanName(p.name)} <span className="text-slate-500">({p.position}, {money(p.capHit ?? 0)})</span></span>
                <button type="submit" className="text-xs px-2 py-0.5 rounded bg-amber-800/60 hover:bg-amber-700 text-white shrink-0">{cs ? "Pustiť" : "Release"}</button>
              </form>
            ))}
          </div>
        </Card>

        <Card title={cs ? "Navrhnúť trade" : "Mock Trade"} accent="text-blue-400">
          <form method="get" className="flex gap-2 mb-3">
            <input type="hidden" name="moves" value={movesRaw} />
            <select name="partner" defaultValue={partner?.id ?? ""} className={inputCls}>
              <option value="">{cs ? "Zvoľ tím…" : "Select partner…"}</option>
              {teams.filter((t) => t.id !== teamId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="submit" className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 shrink-0">{cs ? "Zvoliť" : "Select"}</button>
          </form>
          {partner && (
            <form action={addTradeMoveAction} className="flex flex-col gap-3">
              <input type="hidden" name="currentMoves" value={movesRaw} />
              <input type="hidden" name="partnerTeamId" value={partner.id} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{cs ? "Dávaš" : "Giving"}</p>
                  <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                    {availableMine.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-300">
                        <input type="checkbox" name="give" value={p.id} className="w-3.5 h-3.5" />
                        {cleanName(p.name)} <span className="text-slate-500">({p.position})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{cs ? `Dostávaš (${partner.name})` : `Getting (${partner.name})`}</p>
                  <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                    {partnerRoster.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-300">
                        <input type="checkbox" name="get" value={p.id} className="w-3.5 h-3.5" />
                        {cleanName(p.name)} <span className="text-slate-500">({p.position})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button type="submit" className="self-start text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                {cs ? "Pridať trade do scenára" : "Add trade to scenario"}
              </button>
            </form>
          )}
        </Card>
      </div>

      <Card title={cs ? "Dopad na cap podľa sezón" : "Cap Impact by Season"} accent="text-blue-400">
        <p className="text-xs text-slate-500 mb-3">{cs ? `Projekcia z reálnych zmlúv (rovnaká logika ako Cap Central) — strop ligy je aktuálne ${money(result.capCeiling)}, najlepší dostupný odhad pre budúce sezóny.` : `Projected from contracts — league cap ceiling is currently ${money(result.capCeiling)}.`}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-1.5 pr-3">{cs ? "Sezóna" : "Season"}</th>
                <th className="py-1.5 pr-3">{cs ? "Pred" : "Before"}</th>
                <th className="py-1.5 pr-3">{cs ? "Po" : "After"}</th>
                <th className="py-1.5">{cs ? "Zmena" : "Delta"}</th>
              </tr>
            </thead>
            <tbody>
              {result.capBySeason.map((r) => (
                <tr key={r.year} className="border-b border-slate-900">
                  <td className="py-1.5 pr-3 text-slate-300 font-semibold">{r.year}</td>
                  <td className={`py-1.5 pr-3 ${r.overBefore ? "text-red-400" : "text-slate-300"}`}>{money(r.before)}</td>
                  <td className={`py-1.5 pr-3 ${r.overAfter ? "text-red-400" : "text-slate-300"}`}>{money(r.after)}</td>
                  <td className={`py-1.5 font-semibold ${r.delta > 0 ? "text-red-400" : r.delta < 0 ? "text-emerald-400" : "text-slate-500"}`}>
                    {r.delta > 0 ? "+" : ""}{money(r.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={cs ? "Priemerný vek kádra" : "Average Roster Age"} accent="text-blue-400">
        {result.avgAge.before == null ? (
          <p className="text-sm text-slate-400">{cs ? "Nedá sa vypočítať — roster nemá hráčov s vekom." : "Cannot compute — roster lacks players with age."}</p>
        ) : (
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-slate-200">{result.avgAge.before.toFixed(1)}</span> → <span className="font-semibold text-slate-200">{result.avgAge.after?.toFixed(1)}</span>
            {result.avgAge.delta != null && result.avgAge.delta !== 0 && (
              <span className={result.avgAge.delta > 0 ? "text-amber-400" : "text-emerald-400"}> ({result.avgAge.delta > 0 ? "+" : ""}{result.avgAge.delta})</span>
            )}
          </p>
        )}
      </Card>

      <Card title={cs ? "Posuny v rebríčku formácií/párov" : "Line Rank Shifts"} accent="text-blue-400">
        <p className="text-xs text-slate-500 mb-3">{cs ? "Rovnaké sloty a Role Score ako Analyze My Roster — po zmene sa zostava prepočíta cez auto-lineup." : "Same slots and Role Scores as Analyze My Roster — recomputed via auto-lineup."}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {result.slots.map((s) => (
            <div key={s.id} className="border border-slate-800 bg-slate-900/40 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-200">{s.label}</span>
                {s.delta != null && s.delta !== 0 && (
                  <span className={`text-xs font-bold ${s.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>{s.delta > 0 ? `▲ +${s.delta}` : `▼ ${s.delta}`}</span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {s.before ? (cs ? `${s.before.rank}. z ${s.before.size} (${s.before.avg})` : `#${s.before.rank} of ${s.before.size} (${s.before.avg})`) : (cs ? "nemáš tu nikoho" : "none")}
                {" → "}
                {s.after ? (cs ? `${s.after.rank}. z ${s.after.size} (${s.after.avg})` : `#${s.after.rank} of ${s.after.size} (${s.after.avg})`) : (cs ? "nemáš tu nikoho" : "none")}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
