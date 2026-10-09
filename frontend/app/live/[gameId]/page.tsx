import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, BackPill } from "@/components/ui";
import LiveGame from "@/components/live/LiveGame";
import { canManageTeam } from "@/lib/auth";
import { roundName } from "@/lib/sim/playoffs";

export const dynamic = "force-dynamic";

export default async function LiveGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) notFound();
  const [game, teams] = await Promise.all([
    prisma.game.findUnique({ where: { id }, select: { id: true, seriesId: true, gameNum: true, round: true, league: true, homeTeam: { select: { id: true, name: true, code: true } }, awayTeam: { select: { id: true, name: true, code: true } } } }),
    prisma.team.findMany({ select: { id: true, logoUrl: true } }),
  ]);
  if (!game) notFound();
  // playoff context: "Round 1 · Game 3 · CHI leads 2–1"
  let context: string | null = null;
  if (game.seriesId != null) {
    const ser = await prisma.playoffSeries.findUnique({ where: { id: game.seriesId } });
    if (ser) {
      const code = (tid: number) => [game.homeTeam, game.awayTeam].find((t) => t.id === tid)?.code ?? "";
      const [hi, lo] = [code(ser.highSeedTeamId), code(ser.lowSeedTeamId)];
      const lead = ser.highWins === ser.lowWins ? `series tied ${ser.highWins}–${ser.lowWins}` : ser.highWins > ser.lowWins ? `${hi} leads ${ser.highWins}–${ser.lowWins}` : `${lo} leads ${ser.lowWins}–${ser.highWins}`;
      context = `${roundName(ser.round, ser.conference)} · Game ${game.gameNum ?? "?"} · ${lead}`;
    }
  }
  const logos: Record<number, string> = {};
  for (const t of teams) if (t.logoUrl) logos[t.id] = t.logoUrl;
  // clubs this visitor may coach tonight (their own; an admin gets both)
  const coachTeams: Array<{ id: number; name: string }> = [];
  for (const t of [game.homeTeam, game.awayTeam]) if (await canManageTeam(t.id)) coachTeams.push({ id: t.id, name: t.name });
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3"><BackPill href="/live">Live scoreboard</BackPill></div>
      <PageHeader title={`${game.awayTeam.name} @ ${game.homeTeam.name}`} subtitle={context ?? undefined}
        right={<Link href={`/games/${game.id}`} className="text-sm text-slate-400 hover:text-blue-400">Game report →</Link>} />
      <LiveGame gameId={game.id} logos={logos} home={game.homeTeam} away={game.awayTeam} coachTeams={coachTeams} finalHref={`/games/${game.id}`} />
    </div>
  );
}
