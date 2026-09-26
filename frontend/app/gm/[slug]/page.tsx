import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";
import { gmProfile, gmCareerExtras, type GmTradeRow } from "@/lib/gm-server";
import { money } from "@/lib/finance";

export const dynamic = "force-dynamic";

function Stat({ big, label, sub }: { big: string; label: string; sub?: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="text-2xl font-black text-white tabular-nums leading-none">{big}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400 mt-1.5">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default async function GmProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gm = await gmProfile(slug);
  if (!gm) notFound();

  const pct = (gm.record.pointsPct * 100).toFixed(1);
  const x = await gmCareerExtras(gm.teamId);
  const gradeTone = (g: string) => g.startsWith("A") ? "text-emerald-400 border-emerald-500/40" : g.startsWith("B") ? "text-sky-400 border-sky-500/40" : g === "C" ? "text-amber-400 border-amber-500/40" : "text-red-400 border-red-500/40";
  const day = (d: Date | null) => d ? d.toLocaleDateString("sk-SK", { timeZone: "Europe/Bratislava", day: "numeric", month: "numeric", year: "numeric" }) : "";
  const TradeLine = ({ t, label }: { t: GmTradeRow; label?: string }) => (
    <div className="flex items-start gap-3 py-2">
      <span className={`shrink-0 w-9 text-center rounded border font-black text-sm py-0.5 ${gradeTone(t.grade)}`}>{t.grade}</span>
      <div className="min-w-0 text-sm">
        <div className="text-slate-200">{label && <span className="text-[11px] uppercase tracking-wide text-slate-500 mr-2">{label}</span>}with {t.partnerSlug ? <Link href={`/teams/${t.partnerSlug}`} className="hover:text-blue-400">{t.partner}</Link> : t.partner} <span className="text-[11px] text-slate-500">· {day(t.at)} · <Link href={`/trades/${t.id}`} className="text-blue-400 hover:underline">details</Link></span></div>
        <div className="text-xs text-slate-400"><span className="text-emerald-400/80">got</span> {t.got.join(", ") || "—"} · <span className="text-red-400/80">gave</span> {t.gave.join(", ") || "—"}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={<span>{gm.gmName}{gm.rookieGm && <span className="text-sm font-bold text-rose-400 ml-2 align-middle" title="Rookie GM — new to the league">(R)</span>}</span>}
        subtitle={<span>General Manager · <Link href={`/teams/${gm.teamSlug}`} className="text-blue-400 hover:underline">{gm.teamName}</Link>{gm.since ? ` · since ${gm.since}` : ""}</span>}
        right={gm.logoUrl ? <img src={gm.logoUrl} alt="" className="w-12 h-12 object-contain" /> : undefined}
      />

      {/* career line */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat big={String(gm.seasons)} label="Seasons" />
        <Stat big={`${gm.record.w}-${gm.record.l}-${gm.record.otl}`} label="Career record" sub={`${pct}% points`} />
        <Stat big={`${gm.playoff.seriesWon}-${gm.playoff.seriesLost}`} label="Playoff series" sub={`${gm.playoff.w}-${gm.playoff.l} games · ${gm.playoff.appearances} appearances`} />
        <Stat big={String(gm.championships.length)} label="Championships" sub={gm.championships.join(", ") || undefined} />
        <Stat big={String(gm.awards)} label="Team awards" />
        <Stat big={String(gm.draft.picks)} label="Draft picks" sub={gm.draft.hits ? `${gm.draft.hits} in the NHL` : undefined} />
      </div>

      {/* trade record */}
      <Card title="🔀 Trade Record" accent="text-violet-400">
        {x.trades.graded === 0 ? <p className="text-sm text-slate-500">No completed trades yet.</p> : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Stat big={String(x.trades.count)} label="Trades" />
              <Stat big={x.trades.avgGrade ?? "—"} label="Average grade" sub="UNHL Intelligence" />
              <Stat big={String(x.trades.wins)} label="Won (B+ or better)" />
              <Stat big={String(x.trades.losses)} label="Lost (C or worse)" />
            </div>
            {x.trades.best && <TradeLine t={x.trades.best} label="Best" />}
            {x.trades.worst && x.trades.worst.id !== x.trades.best?.id && <TradeLine t={x.trades.worst} label="Worst" />}
            {x.trades.list.length > 2 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-blue-400">All recent trades ({x.trades.list.length})</summary>
                <div className="divide-y divide-slate-800/60">{x.trades.list.map((t) => <TradeLine key={t.id} t={t} />)}</div>
              </details>
            )}
            <p className="text-[11px] text-slate-500 mt-2">Grade = what this club got vs gave in the shared trade-value model at the time of the deal.</p>
          </>
        )}
      </Card>

      {/* signings */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="✍️ Biggest Free-Agent Signings" accent="text-emerald-400">
          {x.signings.top.length === 0 ? <p className="text-sm text-slate-500">No free-agent signings yet.</p> : (
            <>
              <p className="text-xs text-slate-500 mb-2">{x.signings.count} signings · {money(x.signings.total)} committed in total</p>
              <ul className="divide-y divide-slate-800/60 text-sm">
                {x.signings.top.map((sg) => (
                  <li key={sg.playerId} className="flex items-center gap-2 py-1.5">
                    <span className="flex-1 min-w-0 truncate">{sg.slug ? <Link href={`/players/${sg.slug}`} className="hover:text-blue-400">{sg.name}</Link> : sg.name} <span className="text-xs text-slate-500">{sg.position}{sg.overallNow ? ` · OV ${sg.overallNow}` : ""}{sg.stillHere ? "" : " · moved on"}</span></span>
                    <span className="tabular-nums text-slate-200 shrink-0">{money(sg.salary)} × {sg.years}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        <Card title="🔁 Biggest Extensions" accent="text-sky-400">
          {x.extensions.top.length === 0 ? <p className="text-sm text-slate-500">No extensions yet.</p> : (
            <>
              <p className="text-xs text-slate-500 mb-2">{x.extensions.count} contract extensions</p>
              <ul className="divide-y divide-slate-800/60 text-sm">
                {x.extensions.top.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 py-1.5">
                    <span className="flex-1 min-w-0 truncate">{e.slug ? <Link href={`/players/${e.slug}`} className="hover:text-blue-400">{e.name}</Link> : e.name} <span className="text-xs text-slate-500">{day(e.at)}</span></span>
                    <span className="tabular-nums text-slate-200 shrink-0">{money(e.salary)} × {e.years}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* season by season */}
      <Card title="📅 Season by Season" accent="text-slate-200">
        {x.seasons.length === 0 ? <p className="text-sm text-slate-500">No seasons yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800"><th className="text-left py-1.5">Season</th><th className="text-right px-2">GP</th><th className="text-right px-2">W-L-OTL</th><th className="text-right px-2">PTS</th><th className="text-right px-2">Finish</th><th className="text-left pl-3">Playoffs</th></tr></thead>
              <tbody>
                {x.seasons.map((s) => (
                  <tr key={s.season} className="border-b border-slate-800/50">
                    <td className="py-1.5">{s.season}</td>
                    <td className="text-right px-2 tabular-nums text-slate-400">{s.gp}</td>
                    <td className="text-right px-2 tabular-nums">{s.w}-{s.l}-{s.otl}</td>
                    <td className="text-right px-2 tabular-nums font-bold">{s.points}</td>
                    <td className="text-right px-2 tabular-nums text-slate-400">{s.finish ?? "—"}</td>
                    <td className={`pl-3 ${s.playoffResult === "Champion" ? "text-amber-400 font-bold" : "text-slate-300"}`}>{s.playoffResult === "Champion" ? "🏆 Champion" : s.playoffResult ?? "in progress"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* achievements */}
      <Card title="Achievements" accent="text-amber-400">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {gm.achievements.map((a) => (
            <div key={a.key} className={`rounded-xl border p-3 ${a.earned ? "border-amber-500/40 bg-amber-950/20" : "border-slate-800 bg-slate-900/30 opacity-50"}`}>
              <div className="flex items-center gap-2">
                <span className={`text-2xl ${a.earned ? "" : "grayscale"}`}>{a.icon}</span>
                <div className="min-w-0">
                  <div className={`text-sm font-bold ${a.earned ? "text-amber-300" : "text-slate-400"}`}>{a.label}</div>
                  <div className="text-[11px] text-slate-500 leading-tight">{a.desc}</div>
                </div>
              </div>
              {!a.earned && <div className="text-[10px] uppercase tracking-wide text-slate-600 mt-1.5">Locked</div>}
            </div>
          ))}
        </div>
      </Card>

      {/* draft record */}
      <Card title="🎯 Draft Record" accent="text-sky-400">
        {gm.draft.picks === 0 ? (
          <p className="text-sm text-slate-500">No draft selections on record yet.</p>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">{gm.draft.picks} career selections · {gm.draft.hits} developed into NHL players{gm.draft.stars ? ` · ${gm.draft.stars} stars` : ""}. Outcomes fill in as prospects develop.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                    <th className="text-left py-1.5 pr-2">Year</th><th className="text-left pr-2">Rd</th><th className="text-left pr-2">Pick</th>
                    <th className="text-left pr-2">Player</th><th className="text-left pr-2">Pos</th><th className="text-right px-1.5">OV</th><th className="text-right px-1.5">Pot</th><th className="text-right pl-1.5">Now</th>
                  </tr>
                </thead>
                <tbody>
                  {gm.draft.list.slice(0, 20).map((p, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-1.5 pr-2 tabular-nums">{p.year}</td>
                      <td className="pr-2 tabular-nums text-slate-400">{p.round}</td>
                      <td className="pr-2 tabular-nums text-slate-400">#{p.overallPick}</td>
                      <td className="pr-2">{p.playerSlug ? <Link href={`/players/${p.playerSlug}`} className="hover:text-blue-400">{p.name}</Link> : p.name}</td>
                      <td className="pr-2 text-slate-400">{p.position}</td>
                      <td className="text-right px-1.5 tabular-nums">{p.ov}</td>
                      <td className="text-right px-1.5 tabular-nums text-slate-400">{p.potential}</td>
                      <td className="text-right pl-1.5">{p.ov >= 85 ? <span className="text-amber-400">⭐ star</span> : p.ov >= 78 ? <span className="text-emerald-400">NHL-calibre</span> : <span className="text-slate-600">developing</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {gm.draft.list.length > 20 && <p className="text-[11px] text-slate-600 mt-2">+{gm.draft.list.length - 20} more selections</p>}
          </>
        )}
      </Card>

      {/* honours + links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Honours" accent="text-slate-200">
          <ul className="space-y-1.5 text-sm">
            <li><span className="text-amber-400">🏆 Championships</span> — {gm.championships.length ? gm.championships.join(", ") : "—"}</li>
            <li><span className="text-slate-300">🥈 Finals</span> — {gm.finals.length ? gm.finals.join(", ") : "—"}</li>
            <li><span className="text-green-400">🥇 President&apos;s Trophies</span> — {gm.presidents.length ? gm.presidents.join(", ") : "—"}</li>
            <li><span className="text-orange-400">🔥 Longest win streak</span> — {gm.longestWinStreak} games</li>
            <li><span className="text-slate-300">🔀 Trades completed</span> — {gm.tradesCompleted}</li>
          </ul>
        </Card>
        <Card title="More" accent="text-slate-200">
          <div className="space-y-2 text-sm">
            <Link href={`/teams/${gm.teamSlug}/history`} className="block text-blue-400 hover:underline">Franchise History →</Link>
            <Link href={`/teams/${gm.teamSlug}`} className="block text-blue-400 hover:underline">{gm.teamName} team page →</Link>
            <p className="text-xs text-slate-500 pt-1">The career deepens as the league plays more seasons.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
