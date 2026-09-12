import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamSession } from "@/lib/auth";
import { findTradePartners } from "@/lib/gm-assistant/findTradePartners";
import { SLOTS } from "@/lib/gm-assistant/leagueSlots";
import { cleanName } from "@/lib/playerName";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

// UNHL Intelligence — "Find Trade Partner". Same rule as the other two tools:
// no trade-value model, no willingness-to-deal guess. A slot you're weak at
// (from Analyze My Roster) is ranked league-wide, and every club that
// currently ranks above you there is shown as a candidate — nothing more
// than "this club has more there than you do right now". Open to any
// logged-in GM (see memory: gm-assistant-intelligence) — 404s otherwise.

const inputCls = "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500";
const labelCls = "block text-xs uppercase tracking-wide text-slate-400 mb-1";

export default async function FindTradePartnerPage({ searchParams }: { searchParams: Promise<{ slot?: string }> }) {
  const teamId = await getTeamSession();
  if (teamId == null) notFound();

  const { slot: slotParam } = await searchParams;
  const slotId = SLOTS.some((s) => s.id === slotParam) ? (slotParam as string) : SLOTS[0].id;

  const result = await findTradePartners(teamId, slotId);

  return (
    <div className="py-2 flex flex-col gap-6">
      <PageHeader
        title="🤝 Find Trade Partner"
        subtitle="UNHL Intelligence"
        right={<Link href="/tools/assistant" className="text-sm text-slate-400 hover:text-blue-400">← UNHL Intelligence</Link>}
      />

      <Card bodyClassName="p-4">
        <form method="get" className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className={labelCls}>Ktorý slot v zostave hľadáš posilniť?</label>
            <select name="slot" defaultValue={slotId} className={inputCls}>
              {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">Hľadať</button>
        </form>
      </Card>

      {!result ? (
        <Card><p className="text-slate-500 text-center py-8">Neplatný slot.</p></Card>
      ) : (
        <>
          <Card title="Tvoja pozícia" accent="text-blue-400">
            {result.myRank == null ? (
              <p className="text-sm text-slate-400">Na tomto slote nemáš nikoho — každý klub v zozname nižšie je kandidát.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-slate-400">
                  {result.slot.label} — priemer <span className="text-slate-200 font-semibold">{result.myAvg}</span> rating,{" "}
                  {result.myRank}. miesto z {result.leagueSize} klubov{result.myAuto ? " (z automaticky poskladanej zostavy — nemáš uložené vlastné formácie)" : ""}.
                </p>
              </div>
            )}
          </Card>

          <Card title={`Kandidáti (${result.candidates.length})`} accent="text-emerald-400" bodyClassName="p-3">
            {result.candidates.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Na tomto slote nie je žiadny klub silnejší než ty — nemáš tu koho žiadať.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.candidates.map((c) => (
                  <div key={c.teamId} className="border border-slate-800 bg-slate-900/40 rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-200">{c.teamName}</span>
                      <span className="text-xs font-bold text-emerald-400">{c.rank}. miesto — {c.avg} rating</span>
                    </div>
                    {c.isAuto && <p className="text-[11px] text-amber-400/80">z automaticky poskladanej zostavy — klub nemá uložené vlastné formácie</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {c.players.map((p) => (
                        <Link key={p.id} href={`/players/${p.slug}`} className="text-xs text-slate-300 hover:text-blue-400">
                          {cleanName(p.name)} <span className="text-slate-500">({p.rating ?? "?"})</span>
                        </Link>
                      ))}
                    </div>
                    <Link href={`/trades/build?opp=${c.teamId}`} className="self-start mt-1 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                      Navrhnúť trade →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
