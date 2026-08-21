import PlayerLink from "@/components/PlayerLink";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { weeklyDigest } from "@/lib/weekly-digest";

export const dynamic = "force-dynamic";

function TeamLine({ code, name, slug, logo }: { code: string | null; name: string; slug: string | null; logo: string | null }) {
  const inner = <span className="inline-flex items-center gap-2">{logo && <img src={logo} alt="" className="w-6 h-6 object-contain" />}<span className="font-semibold">{name}</span></span>;
  return slug ? <Link href={`/teams/${slug}`} className="hover:text-blue-400 transition-colors">{inner}</Link> : inner;
}

export default async function WeeklyPage() {
  const d = await weeklyDigest();
  if (!d || d.games === 0) {
    return <div className="space-y-4 py-2"><PageHeader title="Weekly Newsletter" subtitle="The week's story from around the league." /><Card><p className="text-sm text-slate-400">No games this week yet — the recap fills in as the week is played.</p></Card></div>;
  }
  const svp = (v: number) => v.toFixed(3).replace(/^0/, "");
  return (
    <div className="space-y-5 py-2">
      <PageHeader title={`Weekly Newsletter — Week ${d.weekNo}`} subtitle={`${d.games} games · rounds ${d.roundFrom + 1}–${d.roundTo + 1}`} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {d.teamOfWeek && (
          <Card title="🏆 Team of the Week" accent="text-amber-400">
            <TeamLine code={d.teamOfWeek.code} name={d.teamOfWeek.name} slug={d.teamOfWeek.slug} logo={d.teamOfWeek.logo} />
            <p className="text-sm text-slate-300 mt-1.5 tabular-nums">{d.teamOfWeek.w}-{d.teamOfWeek.l}-{d.teamOfWeek.otl} · {d.teamOfWeek.points} pts · {d.teamOfWeek.gf}-{d.teamOfWeek.ga} goals</p>
          </Card>
        )}
        {d.topScorer && (
          <Card title="🌟 Player of the Week" accent="text-sky-400">
            <span className="inline-flex items-center gap-2"><PlayerLink id={d.topScorer.id} name={d.topScorer.name} slug={d.topScorer.slug ?? undefined} clean={false} />{d.topScorer.teamLogo && <img src={d.topScorer.teamLogo} alt="" className="w-4 h-4 object-contain" />}<span className="text-slate-500 text-xs">{d.topScorer.team}</span></span>
            <p className="text-sm text-slate-300 mt-1.5 tabular-nums">{d.topScorer.pts} pts ({d.topScorer.g}G {d.topScorer.a}A) in {d.topScorer.gp} GP</p>
          </Card>
        )}
        {d.bestGoalie && (
          <Card title="🧤 Goalie of the Week" accent="text-emerald-400">
            <span className="inline-flex items-center gap-2"><PlayerLink id={d.bestGoalie.id} name={d.bestGoalie.name} slug={d.bestGoalie.slug ?? undefined} clean={false} />{d.bestGoalie.teamLogo && <img src={d.bestGoalie.teamLogo} alt="" className="w-4 h-4 object-contain" />}<span className="text-slate-500 text-xs">{d.bestGoalie.team}</span></span>
            <p className="text-sm text-slate-300 mt-1.5 tabular-nums">{svp(d.bestGoalie.svPct)} SV% · {d.bestGoalie.record} · {d.bestGoalie.gp} GP</p>
          </Card>
        )}
        {d.surprise && (
          <Card title="😮 Surprise of the Week" accent="text-fuchsia-400">
            <TeamLine code={d.surprise.code} name={d.surprise.name} slug={d.surprise.slug} logo={d.surprise.logo} />
            <p className="text-sm text-slate-300 mt-1.5 tabular-nums">{d.surprise.w}-{d.surprise.l}-{d.surprise.otl} this week — despite sitting {d.surprise.overallRank}th overall.</p>
          </Card>
        )}
      </div>

      {d.tradeOfWeek && (
        <Card title="🔁 Trade of the Week" accent="text-blue-400">
          <p className="text-sm text-slate-200">{d.tradeOfWeek}</p>
        </Card>
      )}
    </div>
  );
}
