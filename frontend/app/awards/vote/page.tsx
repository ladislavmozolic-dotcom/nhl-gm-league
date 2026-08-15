import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { getTeamSession } from "@/lib/auth";
import { buildBallots, VOTED_AWARDS, pointsForPicks } from "@/lib/award-voting";
import { cleanName } from "@/lib/playerName";
import AwardBallotVoter, { type VoteCategory } from "@/components/AwardBallotVoter";

export const dynamic = "force-dynamic";

export default async function AwardVotePage() {
  const teamId = await getTeamSession();
  if (teamId == null) redirect("/login");

  const voting = await prisma.awardVoting.findFirst({ where: { status: "OPEN" }, orderBy: { updatedAt: "desc" } });
  const me = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });

  if (!voting) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="Award Voting" subtitle="Cast your GM ballot" />
        <Card><p className="text-slate-400 text-center py-8">Voting is not open right now. The league admin opens award voting at the end of the season.</p></Card>
      </div>
    );
  }
  const { season, league } = voting;

  const [ballots, myVotes] = await Promise.all([
    buildBallots(season, league),
    prisma.awardVote.findMany({ where: { season, league, voterTeamId: teamId, isAi: false }, select: { category: true, playerId: true, teamId: true, rank: true } }),
  ]);
  // my saved human picks per category, ordered by rank
  const mineByCat = new Map<string, { key: string; rank: number }[]>();
  for (const v of myVotes) {
    const key = v.playerId ? `p${v.playerId}` : `t${v.teamId}`;
    (mineByCat.get(v.category) ?? mineByCat.set(v.category, []).get(v.category)!).push({ key, rank: v.rank });
  }

  const categories: VoteCategory[] = VOTED_AWARDS.map((a) => {
    const cands = (ballots[a.key] ?? []).map((c) => ({ key: c.key, name: cleanName(c.name), subline: c.subline, detail: c.detail, photoUrl: c.photoUrl, logoUrl: c.logoUrl }));
    const myPicks = (mineByCat.get(a.key) ?? []).sort((x, y) => x.rank - y.rank).map((x) => x.key);
    return { key: a.key, label: a.label, subtitle: a.subtitle, icon: a.icon, picks: a.picks, points: pointsForPicks(a.picks), candidates: cands, myPicks };
  }).filter((c) => c.candidates.length > 0);

  return (
    <div className="space-y-6 py-2">
      <PageHeader title={`${season} Award Voting`} subtitle={`${me?.name ?? "Your"} ballot · ${league}`} />
      <div className="text-sm text-slate-400 bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-3">
        Click candidates in your order of preference — 1st pick earns the most points, then descending. You can change any category until voting closes. Ballots are secret: no one but the league admin sees how you voted or the running totals. Categories you leave untouched keep the league&apos;s auto-ballot. <Link href="/awards" className="text-blue-400 hover:underline">View the ceremony →</Link>
      </div>
      <AwardBallotVoter season={season} league={league} categories={categories} />
    </div>
  );
}
