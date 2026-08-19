import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getTeamSession } from "@/lib/auth";
import { getArenaSections, selloutRevenue, attendanceRate } from "@/lib/finance";
import { computeStandings } from "@/lib/sim/standings";
import FinanceEditor, { type HomeGame } from "@/components/FinanceEditor";
import { saveTicketPrices } from "./actions";

export const dynamic = "force-dynamic";

const SEASON = "2026-27";

export default async function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();
  const session = await getTeamSession();
  if (session !== team.id) redirect(`/teams/${slug}/login`);

  const sections = getArenaSections(team);
  const capacity = sections.reduce((s, x) => s + x.capacity, 0);
  const sellout = selloutRevenue(sections);

  // base attendance draw from popularity + record; per-home-game a deterministic nudge
  // (opponent draw + a small stable jitter) gives each night a plausible, varying crowd.
  const standings = await computeStandings(SEASON, "NHL");
  const myStanding = standings.find((s) => s.teamId === team.id);
  const baseRate = attendanceRate(team.popularity ?? 100, myStanding?.pointsPct ?? 0.5);

  const homeFinals = await prisma.game.findMany({
    where: { season: SEASON, status: "FINAL", homeTeamId: team.id, seriesId: null },
    select: { id: true, gameDate: true, awayTeamId: true, homeGoals: true, awayGoals: true, homeShots: true },
    orderBy: [{ gameDate: "asc" }, { id: "asc" }],
  });
  const oppIds = [...new Set(homeFinals.map((g) => g.awayTeamId))];
  const opps = await prisma.team.findMany({ where: { id: { in: oppIds } }, select: { id: true, code: true, logoUrl: true } });
  const oppBy = new Map(opps.map((o) => [o.id, o]));
  // opponent draw: a stronger visiting club fills more seats
  const oppRate = new Map(standings.map((s) => [s.teamId, s.pointsPct]));

  const homeGames: HomeGame[] = homeFinals.map((g) => {
    const jitter = (((g.id * 2654435761) >>> 0) % 1000) / 1000; // 0..1, stable per game
    const oppDraw = ((oppRate.get(g.awayTeamId) ?? 0.5) - 0.5) * 0.10; // ±5% by visitor quality
    const factor = 1 + (jitter - 0.5) * 0.08 + oppDraw;               // ±4% jitter + opp draw
    const frac = Math.max(0.4, Math.min(1, baseRate * factor));
    const attended = Math.round(capacity * frac);
    const gate = Math.round(frac * sellout);
    const hg = g.homeGoals ?? 0, ag = g.awayGoals ?? 0;
    const result = hg > ag ? "W" : hg < ag ? "L" : "T";
    const o = oppBy.get(g.awayTeamId);
    return {
      id: g.id,
      date: g.gameDate ? g.gameDate.toISOString().slice(0, 10) : "",
      oppCode: o?.code ?? "—", oppLogo: o?.logoUrl ?? null,
      result, gf: hg, ga: ag, attended, pct: frac, gate,
    };
  });

  return (
    <FinanceEditor
      teamName={team.name}
      teamSlug={slug}
      arena={team.arena}
      sections={sections}
      capacity={capacity}
      baseRatePct={baseRate}
      homeGames={homeGames}
      onSave={saveTicketPrices}
    />
  );
}
