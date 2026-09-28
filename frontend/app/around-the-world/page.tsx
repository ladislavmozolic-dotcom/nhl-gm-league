import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { Card, PageHeader, Pill, SectionTitle, StatTile } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

const leagueIcon = (region: string) => region === "Europe" ? "🇪🇺" : "🌎";
const statLine = (s: { isGoalie: boolean; gamesPlayed: number; goals: number; assists: number; points: number; wins: number | null; savePercentage: number | null }) =>
  s.isGoalie
    ? `${s.gamesPlayed} GP · ${s.wins ?? 0} W · ${s.savePercentage != null ? `${(s.savePercentage * 100).toFixed(1)} SV%` : "—"}`
    : `${s.gamesPlayed} GP · ${s.goals} G · ${s.assists} A · ${s.points} P`;

export default async function AroundTheWorldPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const teamId = await getTeamSession();
  const [leagues, myProspects, allStats, europeanProspects] = await Promise.all([
    prisma.worldLeague.findMany({
      where: { active: true },
      include: { _count: { select: { teams: true, stats: true } } },
      orderBy: [{ region: "asc" }, { name: "asc" }],
    }),
    teamId == null ? Promise.resolve([]) : prisma.prospect.findMany({
      where: { teamId, worldPlayerId: { not: null } },
      include: { worldPlayer: { include: { currentTeam: { include: { league: true } }, stats: { orderBy: { syncedAt: "desc" }, take: 1 } } } },
      orderBy: { name: "asc" },
    }),
    prisma.worldPlayerSeasonStat.findMany({
      orderBy: [{ points: "desc" }, { gamesPlayed: "desc" }], take: 10,
      include: { player: { include: { currentTeam: true } }, league: true, team: true },
    }),
    prisma.worldPlayerSeasonStat.findMany({ where: { league: { region: "Europe" } }, orderBy: [{ points: "desc" }, { gamesPlayed: "desc" }], include: { player: true, league: true, team: true } }),
  ]);
  const linked = myProspects.filter((p) => p.worldPlayer);
  const noData = leagues.length === 0;
  const leaders = allStats.filter((s) => !s.isGoalie);
  const orderedLeagues = [...leagues].sort((a, b) => Number(b._count.stats > 0) - Number(a._count.stats > 0) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="🌍 Around the World" subtitle="Real-world progress for draft prospects and UNHL organizations — no photos, only the data that matters." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Tracked leagues" value={leagues.length} sub="Junior, college & Europe" color="text-sky-300" />
        <StatTile label="Live stat lines" value={leagues.reduce((n, l) => n + l._count.stats, 0)} sub="Current imported snapshots" color="text-emerald-300" />
        <StatTile label="Your linked prospects" value={linked.length} sub={teamId ? "Ready for daily tracking" : "Sign in to see yours"} color="text-amber-300" />
        <StatTile label="Sync model" value="Daily" sub="Official-source import ready" color="text-violet-300" />
      </div>

      <section>
        <SectionTitle count={leagues.length}>Choose a league</SectionTitle>
        {noData ? <Card><div className="py-8 text-center"><p className="font-semibold text-slate-200">The world database is ready for its first import.</p><p className="mt-2 text-sm text-slate-500">WHL, OHL, QMJHL, NCAA and European prospect tracking can be activated from the commissioner panel.</p></div></Card> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {orderedLeagues.map((l) => <Link key={l.id} href={`/around-the-world/${l.code.toLowerCase()}`} className="block rounded-2xl bg-slate-900/70 border border-slate-800 p-4 shadow-lg shadow-black/20 hover:border-sky-500/50 hover:bg-slate-800/60 transition-colors group"><div className="flex justify-between gap-3"><div className="flex items-start gap-3">{l.logoUrl ? <img src={l.logoUrl} alt="" className="w-10 h-10 object-contain" /> : <span className="text-2xl">{leagueIcon(l.region)}</span>}<div><div className="text-lg font-bold group-hover:text-sky-300">{l.name}</div><div className="mt-1 text-xs text-slate-500">{l.country || l.region} · {l._count.teams} teams</div></div></div><Pill tone={l._count.stats ? "green" : "slate"}>{l._count.stats ? `${l._count.stats} stat lines` : "Awaiting sync"}</Pill></div><div className="mt-4 text-xs font-semibold text-sky-400">View league stats →</div></Link>)}
        </div>}
      </section>

      {teamId != null && (
        <section>
          <SectionTitle count={linked.length} accent="text-amber-300">Your Prospect Tracker</SectionTitle>
          <Card bodyClassName="p-0">
            {linked.length ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="bg-slate-800/30 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500"><th className="text-left px-4 py-3">Prospect</th><th className="text-left px-3 py-3">Team / League</th><th className="text-left px-3 py-3">Current season</th><th className="text-right px-4 py-3">Profile</th></tr></thead><tbody>
                {linked.map((p) => { const w = p.worldPlayer!; const s = w.stats[0]; return <tr key={p.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/25"><td className="px-4 py-3 font-semibold">{p.name}<div className="text-xs text-slate-500 font-normal">{p.position || w.position || "—"}</div></td><td className="px-3 py-3 text-slate-300">{w.currentTeam?.name || "—"}<div className="text-xs text-slate-500">{w.currentTeam?.league.name || "Awaiting assignment"}</div></td><td className="px-3 py-3 text-slate-300">{s ? statLine(s) : <span className="text-slate-500">No current stat line</span>}</td><td className="px-4 py-3 text-right">{w.epUrl ? <a className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer" href={w.epUrl}>EliteProspects ↗</a> : "—"}</td></tr>; })}
              </tbody></table></div>
            ) : <div className="p-6 text-sm text-slate-500">No prospects are linked to a real-world profile yet. The commissioner can connect them as each league is imported.</div>}
          </Card>
        </section>
      )}

      {europeanProspects.length > 0 && <section><SectionTitle count={europeanProspects.length} accent="text-violet-300">European Prospects</SectionTitle><Card bodyClassName="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="bg-slate-800/30 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500"><th className="text-left px-4 py-3">Prospect</th><th className="text-left px-3 py-3">League / Team</th><th className="text-right px-3 py-3">GP</th><th className="text-right px-3 py-3">G</th><th className="text-right px-3 py-3">A</th><th className="text-right px-4 py-3">P</th></tr></thead><tbody>{europeanProspects.map((s) => <tr key={s.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/25"><td className="px-4 py-3 font-semibold">{s.player.name}<span className="ml-2 text-xs font-medium text-violet-300">{s.league.code}</span></td><td className="px-3 py-3 text-slate-300"><span className="inline-flex items-center gap-2">{s.team?.logoUrl && <img src={s.team.logoUrl} alt="" className="w-5 h-5 object-contain" />}{s.team?.name || "—"}</span></td><td className="px-3 py-3 text-right tabular-nums">{s.gamesPlayed}</td><td className="px-3 py-3 text-right tabular-nums">{s.goals}</td><td className="px-3 py-3 text-right tabular-nums">{s.assists}</td><td className="px-4 py-3 text-right tabular-nums font-black text-violet-300">{s.points}</td></tr>)}</tbody></table></div></Card></section>}

      {(view === "leaders" || allStats.length > 0) && <section>
        <SectionTitle count={leaders.length} accent="text-sky-300">World League Leaders</SectionTitle>
        <Card bodyClassName="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="bg-slate-800/30 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500"><th className="text-left px-4 py-3">Player</th><th className="text-left px-3 py-3">League</th><th className="text-left px-3 py-3">Club</th><th className="text-right px-4 py-3">GP</th><th className="text-right px-3 py-3">G</th><th className="text-right px-3 py-3">A</th><th className="text-right px-4 py-3">P</th></tr></thead><tbody>{leaders.map((s) => <tr key={s.id} className="border-b border-slate-800/50 last:border-0"><td className="px-4 py-3 font-semibold">{s.player.name}</td><td className="px-3 py-3 text-slate-400">{s.league.code}</td><td className="px-3 py-3 text-slate-400">{s.team?.name || s.player.currentTeam?.name || "—"}</td><td className="px-4 py-3 text-right tabular-nums">{s.gamesPlayed}</td><td className="px-3 py-3 text-right tabular-nums">{s.goals}</td><td className="px-3 py-3 text-right tabular-nums">{s.assists}</td><td className="px-4 py-3 text-right tabular-nums font-black text-sky-300">{s.points}</td></tr>)}</tbody></table></div></Card>
      </section>}

      <Card title="How it works" accent="text-slate-300"><div className="text-sm text-slate-400 space-y-1"><p><b className="text-slate-200">Junior leagues:</b> full league data can feed the draft board.</p><p><b className="text-slate-200">Europe:</b> only UNHL-owned prospects need to be tracked, keeping imports and storage lean.</p><p><b className="text-slate-200">Identity:</b> EliteProspects IDs and source IDs link records, so a player retains his history after changing league.</p></div></Card>
      {teamId == null && <p className="text-center text-sm text-slate-500">Sign in as a GM to see your organization&apos;s tracked prospects.</p>}
      {view === "draft" && <p className="text-center text-sm text-slate-500">Draft-eligible filtering will populate as the junior-league importer brings in birth dates and current squads.</p>}
    </div>
  );
}
