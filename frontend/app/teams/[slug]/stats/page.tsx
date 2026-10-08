import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { skaterTotals, goalieTotals } from "@/lib/stats-server";
import { getLang } from "@/lib/lang-server";
import TeamStatsView, { type SkaterRow, type GoalieRow } from "@/components/TeamStatsView";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function TeamStatsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  const lang = await getLang();

  const [allSk, allGk] = await Promise.all([
    skaterTotals(SEASON, team.league),
    goalieTotals(SEASON, team.league),
  ]);

  const sk = allSk.filter((r) => r.teamId === team.id);
  const gk = allGk.filter((r) => r.teamId === team.id);

  const skaterRows: SkaterRow[] = sk.map((s) => ({
    playerId: s.playerId,
    name: s.name,
    slug: s.slug ?? null,
    photoUrl: s.photoUrl ?? null,
    number: s.number ?? null,
    position: s.position,
    rookie: s.rookie,
    gp: s.gp,
    goals: s.goals,
    assists: s.assists,
    points: s.points,
    plusMinus: s.plusMinus,
    plusMinus5v5: s.plusMinus5v5 ?? s.plusMinus,
    pim: s.pim,
    hits: s.hits,
    blocks: s.blocks,
    shots: s.shots,
    shtPct: s.shots ? (s.goals / s.shots) * 100 : 0,
    xg: s.xg,
    gax: s.goals - s.xg,
    toiMin: s.toi / 60,
    toiPerGameMin: s.gp ? s.toi / s.gp / 60 : 0,
    ppGoals: s.ppGoals,
    ppAssists: s.ppAssists,
    ppp: s.ppGoals + s.ppAssists,
    shGoals: s.shGoals,
    shAssists: s.shAssists,
    shp: s.shGoals + s.shAssists,
    gwg: s.gwg,
    p60: s.toi ? (s.points * 3600) / s.toi : 0,
  }));

  const goalieRows: GoalieRow[] = gk.map((g) => ({
    playerId: g.playerId,
    name: g.name,
    slug: g.slug ?? null,
    photoUrl: g.photoUrl ?? null,
    gp: g.gp,
    wins: g.wins,
    losses: g.losses,
    otl: g.otl,
    shutouts: g.shutouts,
    shotsAgainst: g.shotsAgainst,
    saves: g.saves,
    goalsAgainst: g.goalsAgainst,
    toiMin: g.toiMin,
    svPct: g.svPct,
    gaa: g.gaa,
    xga: g.xga,
    gsax: g.gsax,
    steals: g.steals,
  }));

  return <TeamStatsView skaters={skaterRows} goalies={goalieRows} lang={lang} />;
}
