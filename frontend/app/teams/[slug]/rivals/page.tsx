import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { canManageTeam } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import RivalsEditor from "@/components/RivalsEditor";
import { teamRivalries, type Rivalry } from "@/lib/rivalry-server";

export const dynamic = "force-dynamic";

function heat(score: number) {
  if (score >= 70) return { label: "Blood feud", tone: "text-red-400", bar: "from-red-600 to-orange-500" };
  if (score >= 45) return { label: "Heated", tone: "text-orange-400", bar: "from-orange-500 to-amber-400" };
  if (score >= 25) return { label: "Simmering", tone: "text-amber-400", bar: "from-amber-500 to-yellow-400" };
  return { label: "Mild", tone: "text-slate-400", bar: "from-slate-600 to-slate-500" };
}

function RivalRow({ r }: { r: Rivalry }) {
  const h = heat(r.score);
  return (
    <div className="px-4 py-3 bg-slate-900/40">
      <div className="flex items-center gap-3">
        {r.logoUrl && <img src={r.logoUrl} alt="" className="w-6 h-6 object-contain shrink-0" />}
        <Link href={`/teams/${r.slug}`} className="font-semibold hover:text-blue-400 flex-1 truncate">{r.name}</Link>
        {r.declared && <span className="text-[10px] uppercase tracking-wide text-red-400/80">declared</span>}
        <span className={`text-xs font-bold uppercase tracking-wide ${h.tone}`}>{h.label}</span>
        <span className="text-2xl font-black tabular-nums w-10 text-right">{r.score}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full bg-gradient-to-r ${h.bar}`} style={{ width: `${r.score}%` }} /></div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
        <span>H2H {r.wins}-{r.losses}</span>
        {r.playoffSeries > 0 && <span className="text-purple-400">{r.playoffSeries} playoff {r.playoffSeries === 1 ? "series" : "series"}</span>}
        {r.fights > 0 && <span className="text-red-400/80">{r.fights} fights</span>}
        {r.injuries > 0 && <span>{r.injuries} injuries</span>}
        {r.trades > 0 && <span>{r.trades} trades</span>}
        {r.sameDivision && <span>division</span>}
      </div>
    </div>
  );
}

export default async function TeamRivalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true, rivalTeamIds: true } });
  if (!team) notFound();

  const [canManage, rivalries] = await Promise.all([canManageTeam(team.id), teamRivalries(team.id)]);
  const top = rivalries.filter((r) => r.score > 0).slice(0, 10);

  const teams = canManage
    ? await prisma.team.findMany({ where: { league: "NHL", id: { not: team.id } }, select: { id: true, name: true, code: true, logoUrl: true, division: true }, orderBy: [{ division: "asc" }, { name: "asc" }] })
    : [];

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Rivalries" subtitle={`${team.name} — rivalry intensity, earned on the ice`} />

      <Card title="🔥 Rivalry Intensity" accent="text-red-400">
        {top.length === 0 ? (
          <p className="text-sm text-slate-500">No rivalries yet — they build from playoff meetings, close series, fights, injuries and trades.</p>
        ) : (
          <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
            {top.map((r) => <RivalRow key={r.teamId} r={r} />)}
          </div>
        )}
        <p className="text-[11px] text-slate-600 mt-2">Score (0–100) = same division + declared rivalries + playoff meetings (deeper rounds weigh more) + close head-to-head + fights + injuries in their games + trades.</p>
      </Card>

      {canManage && (
        <Card title="Declare your rivals" accent="text-slate-300">
          <p className="text-xs text-slate-500 mb-3">Flagged teams add heat (more fights, scrums, misconducts in your games) and boost the rivalry score both ways.</p>
          <RivalsEditor teamId={team.id} teams={teams} initial={team.rivalTeamIds} />
        </Card>
      )}
    </div>
  );
}
