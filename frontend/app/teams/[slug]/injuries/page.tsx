import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import RosterTabs from "@/components/RosterTabs";
import { canManageTeam } from "@/lib/auth";
import { currentInjuries, seasonInjuries } from "@/lib/injuries-server";
import { CurrentInjuryTable, SeasonInjuryTable } from "@/components/InjuryTables";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function TeamInjuriesPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ view?: string }> }) {
  const { slug } = await params;
  const view = (await searchParams).view === "all" ? "all" : "current";
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!team) notFound();

  const [current, all] = view === "current"
    ? [await currentInjuries({ teamId: team.id }), []]
    : [[], await seasonInjuries(SEASON, { teamId: team.id })];

  const Tab = ({ id, label }: { id: string; label: string }) => (
    <Link href={`/teams/${slug}/injuries?view=${id}`}
      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
        view === id ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-400 hover:text-white"
      }`}>{label}</Link>
  );

  return (
    <div className="space-y-4">
      <RosterTabs slug={slug} isGm={await canManageTeam(team.id)} />
      <div className="flex gap-2">
        <Tab id="current" label="Current Injuries" />
        <Tab id="all" label="All Injuries (season)" />
      </div>
      <Card bodyClassName="p-0">
        <div className="p-2">
          {view === "current"
            ? <CurrentInjuryTable rows={current} showTeam={false} />
            : <SeasonInjuryTable rows={all} showTeam={false} />}
        </div>
      </Card>
    </div>
  );
}
