import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { canManageTeam } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import RivalsEditor from "@/components/RivalsEditor";

export const dynamic = "force-dynamic";

export default async function TeamRivalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true, rivalTeamIds: true } });
  if (!team) notFound();

  if (!(await canManageTeam(team.id))) redirect(`/teams/${slug}/login`);

  const teams = await prisma.team.findMany({
    where: { league: "NHL", id: { not: team.id } },
    select: { id: true, name: true, code: true, logoUrl: true, division: true },
    orderBy: [{ division: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Rivalries" subtitle={`${team.name} — set the teams you can't stand.`} />
      <RivalsEditor teamId={team.id} teams={teams} initial={team.rivalTeamIds} />
    </div>
  );
}
