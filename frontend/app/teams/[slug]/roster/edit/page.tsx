import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { canManageTeam } from "@/lib/auth";
import RosterEditor from "@/components/RosterEditor";
import { saveRoster } from "../actions";

export const dynamic = "force-dynamic";

export default async function RosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();
  if (!(await canManageTeam(team.id))) redirect(`/teams/${slug}/login`);

  const players = await prisma.player.findMany({
    where: { teamId: team.id, rosterType: "NHL" },
    select: { id: true, name: true, position: true, number: true, overall: true, captaincy: true, isGoalie: true },
    orderBy: [{ isGoalie: "asc" }, { overall: "desc" }],
  });

  return (
    <RosterEditor
      teamName={team.name}
      teamSlug={slug}
      players={players.map((p) => ({
        id: p.id, name: p.name, position: p.position, number: p.number,
        overall: p.overall ?? 0, captaincy: (p.captaincy as "C" | "A" | null) ?? null, isGoalie: p.isGoalie,
      }))}
      onSave={saveRoster}
    />
  );
}
