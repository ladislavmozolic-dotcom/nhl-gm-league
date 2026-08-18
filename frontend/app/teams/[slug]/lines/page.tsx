import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { loadTeamLines, autoLines } from "@/lib/sim/lines";
import { canManageTeam } from "@/lib/auth";
import LineEditor from "@/components/LineEditor";
import { saveLines } from "./actions";

export const dynamic = "force-dynamic";

export default async function LinesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  // require login as this team, OR any admin GM (who can manage every team)
  if (!(await canManageTeam(team.id))) redirect(`/teams/${slug}/login`);

  const rosterType = team.league === "AHL" ? "AHL" : "NHL";
  const [skaterRows, goalieRows] = await Promise.all([
    prisma.player.findMany({
      where: { teamId: team.id, rosterType, isGoalie: false },
      select: { id: true, name: true, position: true, overall: true, injuryDaysLeft: true },
      orderBy: { overall: "desc" },
    }),
    prisma.player.findMany({
      where: { teamId: team.id, rosterType, isGoalie: true },
      select: { id: true, name: true, position: true, overall: true, injuryDaysLeft: true },
      orderBy: { overall: "desc" },
    }),
  ]);
  const players = skaterRows.map((p) => ({ id: p.id, name: p.name, position: p.position, overall: p.overall ?? 0, injured: (p.injuryDaysLeft ?? 0) > 0 }));
  const goalies = goalieRows.map((p) => ({ id: p.id, name: p.name, position: "G", overall: p.overall ?? 0, injured: (p.injuryDaysLeft ?? 0) > 0 }));

  const saved = await loadTeamLines(team.id);
  const lines = saved ?? autoLines(players, goalies);

  return (
    <LineEditor
      teamName={team.name}
      teamSlug={slug}
      players={players}
      goalies={goalies}
      initial={lines}
      onSave={saveLines}
    />
  );
}
