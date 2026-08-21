import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { scoutingYears, loadBoard } from "@/lib/draft-rankings-server";
import { currentDraftYear, nextDraftYear } from "@/lib/draft-class-import";
import DraftBoardManager from "@/components/DraftBoardManager";

export const dynamic = "force-dynamic";

export default async function DraftRankingsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const teamId = await getTeamSession();

  if (teamId == null) {
    return (
      <div className="space-y-4 py-2">
        <PageHeader title="Draft Rankings" subtitle="Your private scouting board and draft queue." />
        <Card><p className="text-slate-400 text-sm py-6 text-center">Sign in as a GM to build your scouting board. <Link href="/login" className="text-blue-400 hover:underline">GM login →</Link></p></Card>
      </div>
    );
  }

  const [team, years] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { name: true, logoUrl: true } }),
    scoutingYears(),
  ]);
  if (years.length === 0) {
    return (
      <div className="space-y-4 py-2">
        <PageHeader title="Draft Rankings" subtitle="Your private scouting board and draft queue." />
        <Card><p className="text-slate-400 text-sm py-6 text-center">No draft class has been imported yet. The upcoming class loads automatically once NHL Central Scouting publishes it.</p></Card>
      </div>
    );
  }
  // default to the nearest UPCOMING draft (the one being drafted, or the next class),
  // not the oldest historical class that happens to still have undrafted names.
  const [cur, nxt] = await Promise.all([currentDraftYear(), nextDraftYear()]);
  const preferred = [nxt, cur].find((y) => years.includes(y)) ?? years[years.length - 1];
  const wanted = Number(sp.year);
  const year = years.includes(wanted) ? wanted : preferred;
  const rows = await loadBoard(teamId, year);

  return (
    <div className="space-y-5 py-2">
      <PageHeader title="Draft Rankings"
        subtitle={`${team?.name ?? "Your"} private scouting board — search, note and rank the ${year} class. In the Draft Room the top still-available player in your queue is auto-picked ~10s before the clock runs out.`}
        right={<Link href="/draft/room" className="text-sm text-slate-400 hover:text-blue-400">Draft Room →</Link>} />
      <p className="text-xs text-slate-600">🔒 Private to you — no other GM can see your board or queue.</p>
      <DraftBoardManager year={year} years={years} rows={rows} canEdit />
    </div>
  );
}
