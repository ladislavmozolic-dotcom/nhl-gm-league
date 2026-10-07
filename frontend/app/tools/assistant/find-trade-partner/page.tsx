import Link from "next/link";
import { intelligenceAccess } from "@/lib/gm-assistant/access";
import { notFound } from "next/navigation";
import { getTeamSession } from "@/lib/auth";
import { findTradePartners } from "@/lib/gm-assistant/findTradePartners";
import { SLOTS } from "@/lib/gm-assistant/leagueSlots";
import { cleanName } from "@/lib/playerName";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

const inputCls = "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500";
const labelCls = "block text-xs uppercase tracking-wide text-slate-400 mb-1";

export default async function FindTradePartnerPage({ searchParams }: { searchParams: Promise<{ slot?: string }> }) {
  const teamId = await getTeamSession();
  if (teamId == null) notFound();
  if (!(await intelligenceAccess()).full) notFound();

  const lang = await getLang();
  const cs = lang === "cs";

  const { slot: slotParam } = await searchParams;
  const slotId = SLOTS.some((s) => s.id === slotParam) ? (slotParam as string) : SLOTS[0].id;

  const result = await findTradePartners(teamId, slotId);

  return (
    <div className="py-2 flex flex-col gap-6">
      <PageHeader
        title="🤝 Find Trade Partner"
        subtitle="UNHL Intelligence"
        right={<BackPill href="/tools/assistant">UNHL Intelligence</BackPill>}
      />

      <Card bodyClassName="p-4">
        <form method="get" className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className={labelCls}>
              {cs ? "Ktorý slot v zostave hľadáš posilniť?" : "Which roster slot are you looking to upgrade?"}
            </label>
            <select name="slot" defaultValue={slotId} className={inputCls}>
              {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">
            {cs ? "Hľadať" : "Search"}
          </button>
        </form>
      </Card>

      {!result ? (
        <Card><p className="text-slate-500 text-center py-8">{cs ? "Neplatný slot." : "Invalid slot."}</p></Card>
      ) : (
        <>
          <Card title={cs ? "Tvoja pozícia" : "Your Standing"} accent="text-blue-400">
            {result.myRank == null ? (
              <p className="text-sm text-slate-400">
                {cs ? "Na tomto slote nemáš nikoho — každý klub v zozname nižšie je kandidát." : "No players at this slot — all clubs below are surplus candidates."}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-slate-400">
                  {result.slot.label} — {cs ? "priemer" : "avg"} <span className="text-slate-200 font-semibold">{result.myAvg}</span> rating,{" "}
                  {result.myRank}. {cs ? "miesto z" : "of"} {result.leagueSize} {cs ? "klubov" : "clubs"}
                  {result.myAuto ? (cs ? " (z automaticky poskladanej zostavy — nemáš uložené vlastné formácie)" : " (from auto-lines — no saved custom lines)") : ""}.
                </p>
              </div>
            )}
          </Card>

          <Card title={`${cs ? "Kandidáti" : "Candidates"} (${result.candidates.length})`} accent="text-emerald-400" bodyClassName="p-3">
            {result.candidates.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                {cs ? "Na tomto slote nemá nikoho žiadny iný klub v lige." : "No other clubs currently field players at this slot."}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.candidates.map((c) => {
                  const isBetter = result.myRank == null || c.rank < result.myRank;
                  return (
                  <div key={c.teamId} className="border border-slate-800 bg-slate-900/40 rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-200">{c.teamName}</span>
                      <span className={`text-xs font-bold ${isBetter ? "text-emerald-400" : "text-slate-500"}`}>
                        {c.rank}. {cs ? "miesto" : "rank"} — {c.avg} rating
                      </span>
                    </div>
                    {c.isAuto && <p className="text-[11px] text-amber-400/80">{cs ? "z automaticky poskladanej zostavy — klub nemá uložené vlastné formácie" : "from auto-lines — club has not saved custom lines"}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {c.players.map((p) => (
                        <Link key={p.id} href={`/players/${p.slug}`} className="text-xs text-slate-300 hover:text-blue-400">
                          {cleanName(p.name)} <span className="text-slate-500">({p.rating ?? "?"})</span>
                        </Link>
                      ))}
                    </div>
                    <Link href={`/trades/build?opp=${c.teamId}`} className="self-start mt-1 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                      {cs ? "Navrhnúť trade →" : "Propose Trade →"}
                    </Link>
                  </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
