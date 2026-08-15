import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import GameView from "@/components/GameView";
import type { PbpEvent, ShootoutAttempt } from "@/lib/sim/types";
import { loadTeamLines, autoLines, deployDistinct } from "@/lib/sim/lines";
import { cleanName } from "@/lib/playerName";

// Build every line unit for the Lines tab — the manager's lines if set, else the
// same position-aware auto lines the sim uses — resolved to player names.
async function buildLineGroups(teamId: number) {
  const roster = await prisma.player.findMany({
    where: { teamId }, select: { id: true, name: true, position: true, overall: true, shoots: true, isGoalie: true },
  });
  const nameOf = new Map(roster.map((p) => [p.id, cleanName(p.name)]));
  const skaters = roster.filter((p) => !p.isGoalie);
  const ld = (await loadTeamLines(teamId)) ?? autoLines(
    skaters.map((p) => ({ id: p.id, position: p.position ?? "C", overall: p.overall ?? 50, shoots: p.shoots })),
    roster.filter((p) => p.isGoalie).map((p) => ({ id: p.id, overall: p.overall ?? 50 })),
  );
  // Show exactly what the sim iced: 12 different forwards + 6 different D. A
  // manager double-shift (a star in two lines) is resolved to the real depth
  // players so line 4 never mirrors line 1.
  const isDefPos = (pos: string) => /(^|\/)D(\/|$)/.test(pos) || pos === "D";
  const byOv = (a: { overall: number | null }, b: { overall: number | null }) => (b.overall ?? 0) - (a.overall ?? 0);
  const dressedF = skaters.filter((p) => !isDefPos(p.position ?? "")).sort(byOv).map((p) => p.id).slice(0, 12);
  const dressedD = skaters.filter((p) => isDefPos(p.position ?? "")).sort(byOv).map((p) => p.id).slice(0, 6);
  deployDistinct(ld, dressedF, dressedD);
  const nm = (id: number | null | undefined) => (id == null ? null : nameOf.get(id) ?? null);
  const s = ld.situations;
  const NT = { phy: 1, df: 2, of: 2 };
  return [
    { title: "5 vs 5 Forward", cols: ["Left Wing", "Center", "Right Wing"], units: ld.forwardLines.map((l, i) => ({ n: i + 1, players: [nm(l.lw), nm(l.c), nm(l.rw)], tactic: l.tactic ?? NT, wanted: l.timePct })) },
    { title: "5 vs 5 Defense", cols: ["Left D", "Right D"], units: ld.defensePairs.map((p, i) => ({ n: i + 1, players: [nm(p.ld), nm(p.rd)], tactic: p.tactic ?? NT, wanted: p.timePct })) },
    { title: "Power Play", cols: ["", "", "", "", ""], units: s.pp.map((u, i) => ({ n: i + 1, players: u.players.map(nm), tactic: u.tactic ?? { phy: 0, df: 1, of: 4 }, wanted: u.timePct })) },
    { title: "Penalty Kill (4)", cols: ["", "", "", ""], units: s.pk4.map((u, i) => ({ n: i + 1, players: u.players.map(nm), tactic: u.tactic ?? { phy: 1, df: 4, of: 0 }, wanted: u.timePct })) },
    { title: "Penalty Kill (3)", cols: ["", "", ""], units: s.pk3.map((u, i) => ({ n: i + 1, players: u.players.map(nm), tactic: u.tactic ?? { phy: 1, df: 4, of: 0 }, wanted: u.timePct })) },
    { title: "4 vs 4", cols: ["", "", "", ""], units: s.fourVFour.map((u, i) => ({ n: i + 1, players: u.players.map(nm), tactic: u.tactic ?? NT, wanted: u.timePct })) },
    { title: "Overtime (3 vs 3)", cols: ["", "", ""], units: s.overtime.map((u, i) => ({ n: i + 1, players: u.players.map(nm), tactic: u.tactic ?? { phy: 0, df: 1, of: 4 }, wanted: u.timePct })) },
  ];
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await prisma.game.findUnique({
    where: { id: Number(id) },
    include: {
      homeTeam: true,
      awayTeam: true,
      goalEvents: { orderBy: [{ period: "asc" }, { seconds: "asc" }] },
      penaltyEvents: { orderBy: [{ period: "asc" }, { seconds: "asc" }] },
      playerStats: { include: { player: { select: { name: true, position: true, slug: true, number: true } } } },
      goalieStats: { include: { player: { select: { name: true, slug: true } } } },
    },
  });
  if (!game || game.status !== "FINAL") notFound();

  const teamMeta = (t: typeof game.homeTeam) => ({
    teamId: t.id, name: t.name, slug: t.slug, logoUrl: t.logoUrl, code: t.code,
  });

  const skaters = (teamId: number) => game.playerStats
    .filter((s) => s.teamId === teamId)
    .map((s) => ({
      id: s.playerId, name: s.player.name, position: s.player.position, slug: s.player.slug,
      goals: s.goals, assists: s.assists, points: s.points, shots: s.shots, pim: s.pim,
      plusMinus: s.plusMinus, ppGoals: s.ppGoals, shGoals: s.shGoals, gwg: s.gwg,
      hits: s.hits, blocks: s.blocks, faceoffWins: s.faceoffWins, faceoffLosses: s.faceoffLosses,
      toi: s.toi, conAfter: s.conAfter,
    }))
    .sort((a, b) => b.points - a.points || b.goals - a.goals || b.toi - a.toi);

  // enrich goals with scorer/assist slugs + which goal of the season each was
  const scorerIds = [...new Set(game.goalEvents.map((g) => g.scorerId))];
  const assistIds = [...new Set(game.goalEvents.flatMap((g) => g.assistIds))];
  // "prior" = games earlier in the season than this one. Order by `round` (the
  // scheduling day) — gameDate isn't always set, which used to make this count
  // the whole season, so a game-1 scorer showed a 30-goal total.
  const priorGame = game.round != null
    ? { status: "FINAL" as const, seriesId: null, season: game.season, round: { lt: game.round } }
    : { status: "FINAL" as const, seriesId: null, season: game.season, id: { lt: game.id } };
  const [priorGoals, priorAssists, involved] = await Promise.all([
    scorerIds.length ? prisma.gameGoal.groupBy({ by: ["scorerId"], where: { scorerId: { in: scorerIds }, game: priorGame }, _count: { _all: true } }) : Promise.resolve([]),
    assistIds.length ? prisma.playerGameStat.groupBy({ by: ["playerId"], where: { playerId: { in: assistIds }, game: priorGame }, _sum: { assists: true } }) : Promise.resolve([]),
    prisma.player.findMany({ where: { id: { in: [...new Set([...scorerIds, ...assistIds])] } }, select: { id: true, slug: true } }),
  ]);
  const priorGoalMap = new Map(priorGoals.map((p) => [p.scorerId, p._count._all]));
  const priorAssistMap = new Map(priorAssists.map((a) => [a.playerId, a._sum.assists ?? 0]));
  const runningAssist = new Map<number, number>();
  const slugById = new Map(involved.map((p) => [p.id, p.slug]));
  const runningGoal = new Map<number, number>();

  const goalies = (teamId: number) => game.goalieStats
    .filter((s) => s.teamId === teamId)
    .map((s) => ({
      id: s.playerId, name: s.player.name, slug: s.player.slug, started: s.started,
      shotsAgainst: s.shotsAgainst, saves: s.saves, goalsAgainst: s.goalsAgainst,
      conBefore: s.conBefore, conAfter: s.conAfter, fatigued: s.fatigued, decision: s.decision,
    }))
    .sort((a, b) => Number(b.started) - Number(a.started));

  const [homeLines, awayLines] = await Promise.all([
    buildLineGroups(game.homeTeamId), buildLineGroups(game.awayTeamId),
  ]);

  const data = {
    id: game.id,
    endedIn: game.endedIn ?? "REG",
    home: {
      ...teamMeta(game.homeTeam), goals: game.homeGoals ?? 0, shots: game.homeShots ?? 0,
      goalsByPeriod: game.homeGoalsByPeriod, shotsByPeriod: game.homeShotsByPeriod,
      skaters: skaters(game.homeTeamId), goalies: goalies(game.homeTeamId), lines: homeLines,
    },
    away: {
      ...teamMeta(game.awayTeam), goals: game.awayGoals ?? 0, shots: game.awayShots ?? 0,
      goalsByPeriod: game.awayGoalsByPeriod, shotsByPeriod: game.awayShotsByPeriod,
      skaters: skaters(game.awayTeamId), goalies: goalies(game.awayTeamId), lines: awayLines,
    },
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    goals: game.goalEvents.map((g) => {
      const n = (runningGoal.get(g.scorerId) ?? 0) + 1;
      runningGoal.set(g.scorerId, n);
      return {
        period: g.period, seconds: g.seconds, teamId: g.teamId,
        scorerName: g.scorerName, scorerSlug: slugById.get(g.scorerId) ?? null,
        scorerSeasonGoal: (priorGoalMap.get(g.scorerId) ?? 0) + n,
        assistNames: g.assistNames,
        assists: g.assistIds.map((aid, i) => {
          const ra = (runningAssist.get(aid) ?? 0) + 1; runningAssist.set(aid, ra);
          return { name: g.assistNames[i] ?? "", slug: slugById.get(aid) ?? null, total: (priorAssistMap.get(aid) ?? 0) + ra };
        }),
        strength: g.strength, emptyNet: g.emptyNet,
      };
    }),
    penalties: game.penaltyEvents.map((p) => ({
      period: p.period, seconds: p.seconds, teamId: p.teamId,
      playerName: p.playerName, type: p.type, minutes: p.minutes, severity: p.severity,
    })),
    playByPlay: (game.playByPlay as unknown as PbpEvent[] | null) ?? [],
    shootout: ((game.shootout as unknown as ShootoutAttempt[] | null) ?? []).map((a) => ({
      ...a, teamCode: a.teamId === game.homeTeamId ? game.homeTeam.code : game.awayTeam.code,
      shooterSlug: slugById.get(a.shooterId) ?? null,
    })),
  };

  return <GameView data={data} />;
}
