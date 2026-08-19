import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { canManageTeam } from "@/lib/auth";
import LinesNav from "@/components/LinesNav";
import RosterEditor from "@/components/RosterEditor";
import { saveRoster } from "../../roster/actions";

export const dynamic = "force-dynamic";

// Captains & numbers, living under the Lines section (alongside the Line Editor and
// Line Builder) so a GM sets the C/A letters and jersey numbers right where he builds
// his lineup.
export default async function LinesCaptainsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!team) notFound();
  if (!(await canManageTeam(team.id))) redirect(`/teams/${slug}/login`);

  const players = await prisma.player.findMany({
    where: { teamId: team.id, rosterType: "NHL" },
    select: { id: true, name: true, position: true, number: true, overall: true, captaincy: true, isGoalie: true },
    orderBy: [{ isGoalie: "asc" }, { overall: "desc" }],
  });

  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">
      <LinesNav teamName={team.name} teamSlug={slug} />
      <RosterEditor
        teamName={team.name}
        teamSlug={slug}
        embedded
        players={players.map((p) => ({
          id: p.id, name: p.name, position: p.position, number: p.number,
          overall: p.overall ?? 0, captaincy: (p.captaincy as "C" | "A" | null) ?? null, isGoalie: p.isGoalie,
        }))}
        onSave={saveRoster}
      />
    </div>
  );
}
