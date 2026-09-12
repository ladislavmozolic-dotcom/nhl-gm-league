import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { cleanName } from "@/lib/playerName";
import { PageHeader, BackPill } from "@/components/ui";
import PlayerIntelligenceCard from "@/components/PlayerIntelligenceCard";
import PlayerFitCard from "@/components/PlayerFitCard";
import ContractIntelCard from "@/components/ContractIntelCard";

export const dynamic = "force-dynamic";

// UNHL Intelligence — Player/Contract Intelligence (phase 4), moved out of the
// main player profile into its own page at the user's request: it used to
// render inline on every player's profile, always taking up space there —
// now it's a dedicated subpage reached via the "🧠 UNHL Intelligence" button
// on the profile, with a back link here to return. Same gate the 3 cards
// below already required individually (a signed-in GM session) — 404
// otherwise, since there's nothing to show a logged-out visitor here.
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
        title={
          <span className="inline-flex items-center gap-3">
            <span className="w-11 h-11 shrink-0 rounded-full overflow-hidden bg-slate-800/80 ring-1 ring-white/10">
              {player.photoUrl ? (
                <img src={player.photoUrl} alt={cleanName(player.name)} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-lg font-black text-slate-600">{player.name?.[0] ?? "?"}</span>
              )}
            </span>
            🧠 UNHL Intelligence — {cleanName(player.name)}
          </span>
        }
        subtitle={player.team ? player.team.name : "Free Agent"}
        right={<BackPill href={`/players/${player.id}`}>Späť na profil</BackPill>}
      />
      <PlayerIntelligenceCard playerId={player.id} />
      <PlayerFitCard playerId={player.id} playerTeamId={player.teamId ?? null} viewerTeamId={gmTeamId} />
      <ContractIntelCard playerId={player.id} />
    </div>
  );
}
