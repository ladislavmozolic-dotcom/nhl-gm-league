import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { canManageTeam } from "@/lib/auth";
import { teamLineBuilder } from "@/lib/line-builder-server";
import LinesNav from "@/components/LinesNav";
import LineBuilderView from "@/components/LineBuilderView";

export const dynamic = "force-dynamic";

export default async function LineBuilderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true, league: true } });
  if (!team) notFound();
  if (!(await canManageTeam(team.id))) redirect(`/teams/${slug}/login`);

  const build = await teamLineBuilder(team.id, team.league ?? "NHL");

  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">
      <LinesNav teamName={team.name} teamSlug={slug} />
      <LineBuilderView build={build} />
    </div>
  );
}
