import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { canManageTeam } from "@/lib/auth";
import RosterMover from "@/components/RosterMover";
import { saveRosterMoves, releasePlayer } from "./actions";

export const dynamic = "force-dynamic";

export default async function RostersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { affiliateTeams: { select: { id: true, name: true } } },
  });
  if (!team) notFound();
  if (!(await canManageTeam(team.id))) redirect(`/teams/${slug}/login`);

  const affiliate = team.affiliateTeams[0] ?? null;
  const orgTeamIds = [team.id, ...(affiliate ? [affiliate.id] : [])];

  const players = await prisma.player.findMany({
    // only real roster players (NHL/AHL) — released UFAs, prospects and retirees keep a
    // team id (schema requires one) but must never surface in the roster manager.
    where: { teamId: { in: orgTeamIds }, rosterType: { in: ["NHL", "AHL"] } },
    select: { id: true, name: true, position: true, overall: true, isGoalie: true, rosterType: true, contractType: true, capHit: true, scratched: true, teamId: true },
    orderBy: [{ isGoalie: "asc" }, { overall: "desc" }],
  });

  return (
    <RosterMover
      teamName={team.name}
      teamSlug={slug}
      affiliateName={affiliate?.name ?? "(no affiliate)"}
      hasAffiliate={!!affiliate}
      players={players.map((p) => ({
        id: p.id, name: p.name, position: p.position, overall: p.overall ?? 0,
        isGoalie: p.isGoalie,
        side: (p.rosterType === "AHL" ? (p.scratched ? "farm-scratched" : "farm") : (p.scratched ? "pro-scratched" : "pro")) as "pro" | "pro-scratched" | "farm" | "farm-scratched",
        contractType: (p.contractType as "ONE_WAY" | "TWO_WAY" | null) ?? null,
        capHit: p.capHit ?? 0,
      }))}
      onSave={saveRosterMoves}
      onRelease={releasePlayer}
    />
  );
}
