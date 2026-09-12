import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { cleanName } from "@/lib/playerName";
import { PageHeader } from "@/components/ui";
import PlayerIntelligenceCard from "@/components/PlayerIntelligenceCard";
import PlayerFitCard from "@/components/PlayerFitCard";
import ContractIntelCard from "@/components/ContractIntelCard";

export const dynamic = "force-dynamic";

// UNHL Intelligence — Player/Contract Intelligence (phase 4), moved out of the
// main player profile into its own page at the user's request: it used to
// render inline on every player's profile, always taking up space there —
// now it's a separate window/tab reached via the "🧠 UNHL Intelligence"
// button on the profile (opened with target="_blank", same pattern as the
// existing EliteProspects link). Same gate the 3 cards below already
// required individually (a signed-in GM session) — 404 otherwise, since
// there's nothing to show a logged-out visitor here.
export default async function PlayerIntelligencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gmTeamId = await getTeamSession();
  if (gmTeamId == null) notFound();

  const where = /^\d+$/.test(id) ? { id: parseInt(id, 10) } : { slug: id };
  const player = await prisma.player.findFirst({
    where,
    select: { id: true, name: true, slug: true, teamId: true, photoUrl: true, team: { select: { name: true, slug: true, logoUrl: true } } },
  });
  if (!player) notFound();

  return (
    <div className="py-2 flex flex-col gap-6">
      <PageHeader
        title={`🧠 UNHL Intelligence — ${cleanName(player.name)}`}
        subtitle={player.team ? player.team.name : "Free Agent"}
        right={<Link href={`/players/${player.id}`} className="text-sm text-slate-400 hover:text-blue-400">← Späť na profil</Link>}
      />
      <PlayerIntelligenceCard playerId={player.id} />
      <PlayerFitCard playerId={player.id} playerTeamId={player.teamId ?? null} viewerTeamId={gmTeamId} />
      <ContractIntelCard playerId={player.id} />
    </div>
  );
}
