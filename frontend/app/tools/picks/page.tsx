import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { getSeasonPicksData } from "@/lib/season-picks-server";
import SeasonPicksView from "./SeasonPicksView";

export const dynamic = "force-dynamic";

export default async function SeasonPicksPage() {
  const teamId = await getTeamSession();
  const admin = await isAdmin();

  const data = await getSeasonPicksData(teamId);

  const viewerTeam = teamId
    ? await prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, name: true, slug: true, logoUrl: true, gm: true, gmNickname: true },
      })
    : null;

  return (
    <main className="min-h-screen pb-16 pt-4 text-slate-100 px-3 sm:px-6 max-w-7xl mx-auto">
      <SeasonPicksView
        initialData={data}
        viewerTeam={viewerTeam}
        isAdmin={admin}
      />
    </main>
  );
}
