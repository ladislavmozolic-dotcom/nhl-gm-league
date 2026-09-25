import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import Countdown from "@/components/all-star/Countdown";
import AutoRefresh from "@/components/AutoRefresh";
import { getTradeDeadline } from "@/lib/trade-deadline";
import { deadlineDeals, winnersAndLosers, DEADLINE_WEEK_DAYS } from "@/lib/deadline-server";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", weekday: "long", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
const time = (d: Date) => d.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
const gradeTone = (g: string) => g.startsWith("A") ? "text-emerald-400 border-emerald-500/40" : g.startsWith("B") ? "text-sky-400 border-sky-500/40" : g === "C" ? "text-amber-400 border-amber-500/40" : "text-red-400 border-red-500/40";

export default async function DeadlineDayPage() {
  const deadline = await getTradeDeadline();
  const now = new Date();
  const passed = !!deadline && deadline <= now;
  const inWeek = !!deadline && !passed && deadline.getTime() - now.getTime() <= DEADLINE_WEEK_DAYS * 86400000;
  const deals = deadline && (inWeek || passed) ? await deadlineDeals(deadline, now) : [];
  const clubs = winnersAndLosers(deals);
  const live = inWeek && deadline!.getTime() - now.getTime() <= 24 * 3600000;

  return (
    <div className="space-y-6 py-2">
      {live && <AutoRefresh seconds={30} />}
      <PageHeader title="⏰ Deadline Day" subtitle={deadline ? `NHL trade deadline · ${fmt(deadline)}` : "No trade deadline set"} right={<Link href="/trades/build" className="text-sm text-blue-400 hover:underline">Trade Room →</Link>} />

      <div className={`rounded-xl border p-5 text-center ${passed ? "border-slate-700 bg-slate-900/60" : live ? "border-red-700/60 bg-red-950/30" : "border-amber-700/50 bg-amber-950/20"}`}>
        {!deadline ? <p className="text-slate-400">The commissioner hasn&apos;t set a trade deadline.</p>
          : passed ? (<>
            <div className="text-2xl font-black text-slate-100">🔒 The deadline has passed</div>
            <p className="text-sm text-slate-400 mt-1">Trading reopens once a club&apos;s season is over (NHL rule). {deals.length} deal{deals.length === 1 ? "" : "s"} in the final week.</p>
          </>) : (<>
            <div className="text-[11px] uppercase tracking-widest text-slate-400">{live ? "🚨 Deadline day — live" : "Trade deadline in"}</div>
            <div className="text-4xl font-black text-white mt-1"><Countdown to={deadline.toISOString()} done="closed" /></div>
            <p className="text-xs text-slate-400 mt-2">Deals must be accepted (and approved, for rookie GMs) before {deadline.toLocaleTimeString("sk-SK", { timeZone: "Europe/Bratislava", hour: "2-digit", minute: "2-digit" })} Bratislava time. Tonight&apos;s sim then runs with the new rosters.</p>
          </>)}
      </div>

      {(inWeek || passed) && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title={`📋 Deals — final ${DEADLINE_WEEK_DAYS} days (${deals.length})`} accent="text-blue-400">
              {deals.length === 0 ? <p className="text-sm text-slate-500">No deals yet — the phones are ringing…</p> : (
                <ul className="divide-y divide-slate-800/70">
                  {deals.map((d) => (
                    <li key={d.id} className="py-3">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1.5">
                        <span className="tabular-nums">{time(d.at)}</span>
                        {d.deadlineDay && <span className="rounded bg-red-600/20 text-red-300 px-1.5 font-bold">DEADLINE DAY</span>}
                        <Link href={`/trades/${d.id}`} className="ml-auto text-blue-400 hover:underline">details</Link>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {([["from", d.fromName, d.fromLogo, d.fromGrade, d.toGives], ["to", d.toName, d.toLogo, d.toGrade, d.fromGives]] as const).map(([k, name, logo, grade, gets]) => (
                          <div key={k} className="flex items-start gap-2 rounded-lg bg-slate-800/40 p-2">
                            <span className={`shrink-0 w-9 text-center rounded border font-black text-sm py-0.5 ${gradeTone(grade)}`}>{grade}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">{logo && <img src={logo} alt="" className="w-4 h-4 object-contain" />}{name} get</div>
                              <div className="text-xs text-slate-400">{gets.join(", ") || "—"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5">{d.verdict}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <Card title="🏆 Winners & losers" accent="text-amber-400">
            {clubs.length === 0 ? <p className="text-sm text-slate-500">Nobody has moved yet.</p> : (
              <ol className="space-y-1.5 text-sm">
                {clubs.map((c, i) => (
                  <li key={c.teamId} className="flex items-center gap-2">
                    <span className="w-5 text-slate-500 tabular-nums">{i + 1}.</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-slate-500">{c.deals}×</span>
                    <span className="flex gap-1">{c.grades.map((g, j) => <span key={j} className={`text-[11px] font-bold ${gradeTone(g).split(" ")[0]}`}>{g}</span>)}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-[11px] text-slate-500 mt-3">Grades by UNHL Intelligence — the shared trade-value model (what each side gave vs got) at the time of the deal.</p>
          </Card>
        </div>
      )}
      {deadline && !inWeek && !passed && <Card><p className="text-sm text-slate-400">The live deal feed opens {DEADLINE_WEEK_DAYS} days before the deadline. Every GM gets a reminder 24 hours before, and a winners-and-losers recap is posted to League News once it passes.</p></Card>}
    </div>
  );
}
