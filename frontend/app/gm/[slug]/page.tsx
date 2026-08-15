import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";
import { gmProfile } from "@/lib/gm-server";

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

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={gm.gmName}
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
                      <td className="text-right pl-1.5">{p.status ? <span className={p.status === "NHL" ? "text-emerald-400" : "text-slate-400"}>{p.status}{p.overall ? ` ${p.overall}` : ""}</span> : <span className="text-slate-600">prospect</span>}</td>
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
            <p className="text-xs text-slate-500 pt-1">Draft-and-develop success and multi-team GM careers deepen as the league plays more seasons.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
