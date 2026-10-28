import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { skaterTotals, goalieTotals } from "@/lib/stats-server";
import { getLang } from "@/lib/lang-server";
import TeamStatsView, {
  type SkaterRow,
  type GoalieRow,
  type SkaterSplitRow,
  type GoalieSplitRow,
} from "@/components/TeamStatsView";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function TeamStatsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  const lang = await getLang();

  const [allTeams, rosterPlayers, allSk, allGk, skMinIds, gkMinIds] = await Promise.all([
    prisma.team.findMany({ select: { id: true, name: true, code: true, slug: true } }),
    prisma.player.findMany({
      where: { teamId: team.id },
      select: { id: true, teamId: true },
    }),
    skaterTotals(SEASON, team.league),
    goalieTotals(SEASON, team.league),
    prisma.playerGameStat.groupBy({
      by: ["playerId", "teamId"],
      where: { game: { season: SEASON, league: team.league, status: "FINAL", seriesId: null } },
      _min: { id: true },
    }),
    prisma.goalieGameStat.groupBy({
      by: ["playerId", "teamId"],
      where: { game: { season: SEASON, league: team.league, status: "FINAL", seriesId: null } },
      _min: { id: true },
    }),
  ]);

  const teamMap = new Map(allTeams.map((t) => [t.id, t]));
  const rosterIds = new Set(rosterPlayers.map((p) => p.id));
  const skOrderMap = new Map(skMinIds.map((m) => [`${m.playerId}:${m.teamId}`, m._min.id ?? 0]));
  const gkOrderMap = new Map(gkMinIds.map((m) => [`${m.playerId}:${m.teamId}`, m._min.id ?? 0]));

  // Skaters
  const skByPlayer = new Map<number, typeof allSk>();
  for (const s of allSk) {
    const list = skByPlayer.get(s.playerId) ?? [];
    list.push(s);
    skByPlayer.set(s.playerId, list);
  }

  const relevantSkaterIds = new Set<number>();
  for (const s of allSk) {
    if (s.teamId === team.id || rosterIds.has(s.playerId)) {
      relevantSkaterIds.add(s.playerId);
    }
  }

  const skaterRows: SkaterRow[] = [];
  for (const pid of relevantSkaterIds) {
    const rawSplits = skByPlayer.get(pid) ?? [];
    rawSplits.sort(
      (a, b) =>
        (skOrderMap.get(`${a.playerId}:${a.teamId}`) ?? 0) -
        (skOrderMap.get(`${b.playerId}:${b.teamId}`) ?? 0)
    );
    const base = rawSplits[0];
    if (!base) continue;

    const isDeparted = !rosterIds.has(pid);
    const hasSplits =
      rawSplits.length > 1 || (rawSplits.length === 1 && rawSplits[0].teamId !== team.id);

    const tot = {
      gp: 0,
      goals: 0,
      assists: 0,
      points: 0,
      shots: 0,
      pim: 0,
      plusMinus: 0,
      plusMinus5v5: 0,
      ppGoals: 0,
      shGoals: 0,
      ppAssists: 0,
      shAssists: 0,
      gwg: 0,
      hits: 0,
      blocks: 0,
      toi: 0,
      xg: 0,
    };
    for (const sp of rawSplits) {
      tot.gp += sp.gp;
      tot.goals += sp.goals;
      tot.assists += sp.assists;
      tot.points += sp.points;
      tot.shots += sp.shots;
      tot.pim += sp.pim;
      tot.plusMinus += sp.plusMinus;
      tot.plusMinus5v5 += sp.plusMinus5v5 ?? sp.plusMinus;
      tot.ppGoals += sp.ppGoals;
      tot.shGoals += sp.shGoals;
      tot.ppAssists += sp.ppAssists;
      tot.shAssists += sp.shAssists;
      tot.gwg += sp.gwg;
      tot.hits += sp.hits;
      tot.blocks += sp.blocks;
      tot.toi += sp.toi;
      tot.xg += sp.xg;
    }

    const teamSplit = rawSplits.find((sp) => sp.teamId === team.id);
    const teamForStats = teamSplit
      ? {
          gp: teamSplit.gp,
          goals: teamSplit.goals,
          assists: teamSplit.assists,
          points: teamSplit.points,
          plusMinus: teamSplit.plusMinus,
          plusMinus5v5: teamSplit.plusMinus5v5 ?? teamSplit.plusMinus,
          pim: teamSplit.pim,
          hits: teamSplit.hits,
          blocks: teamSplit.blocks,
          shots: teamSplit.shots,
          ppGoals: teamSplit.ppGoals,
          ppAssists: teamSplit.ppAssists,
          ppp: teamSplit.ppGoals + teamSplit.ppAssists,
          shGoals: teamSplit.shGoals,
          shAssists: teamSplit.shAssists,
          shp: teamSplit.shGoals + teamSplit.shAssists,
          gwg: teamSplit.gwg,
          toiMin: teamSplit.toi / 60,
          toiPerGameMin: teamSplit.gp ? teamSplit.toi / teamSplit.gp / 60 : 0,
        }
      : {
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          plusMinus: 0,
          plusMinus5v5: 0,
          pim: 0,
          hits: 0,
          blocks: 0,
          shots: 0,
          ppGoals: 0,
          ppAssists: 0,
          ppp: 0,
          shGoals: 0,
          shAssists: 0,
          shp: 0,
          gwg: 0,
          toiMin: 0,
          toiPerGameMin: 0,
        };

    const splits: SkaterSplitRow[] | undefined = hasSplits
      ? rawSplits.map((sp) => {
          const tInfo = teamMap.get(sp.teamId!);
          return {
            teamId: sp.teamId!,
            teamCode: tInfo?.code ?? "—",
            teamName: tInfo?.name ?? "—",
            teamSlug: tInfo?.slug ?? null,
            gp: sp.gp,
            goals: sp.goals,
            assists: sp.assists,
            points: sp.points,
            plusMinus: sp.plusMinus,
            plusMinus5v5: sp.plusMinus5v5 ?? sp.plusMinus,
            pim: sp.pim,
            hits: sp.hits,
            blocks: sp.blocks,
            shots: sp.shots,
            shtPct: sp.shots ? (sp.goals / sp.shots) * 100 : 0,
            xg: sp.xg,
            gax: sp.goals - sp.xg,
            toiMin: sp.toi / 60,
            toiPerGameMin: sp.gp ? sp.toi / sp.gp / 60 : 0,
            ppGoals: sp.ppGoals,
            ppAssists: sp.ppAssists,
            ppp: sp.ppGoals + sp.ppAssists,
            shGoals: sp.shGoals,
            shAssists: sp.shAssists,
            shp: sp.shGoals + sp.shAssists,
            gwg: sp.gwg,
            p60: sp.toi ? (sp.points * 3600) / sp.toi : 0,
          };
        })
      : undefined;

    skaterRows.push({
      playerId: pid,
      name: base.name,
      slug: base.slug ?? null,
      photoUrl: base.photoUrl ?? null,
      number: base.number ?? null,
      position: base.position,
      rookie: base.rookie,
      isDeparted,
      hasSplits,
      splits,
      teamForStats,
      gp: tot.gp,
      goals: tot.goals,
      assists: tot.assists,
      points: tot.points,
      plusMinus: tot.plusMinus,
      plusMinus5v5: tot.plusMinus5v5,
      pim: tot.pim,
      hits: tot.hits,
      blocks: tot.blocks,
      shots: tot.shots,
      shtPct: tot.shots ? (tot.goals / tot.shots) * 100 : 0,
      xg: tot.xg,
      gax: tot.goals - tot.xg,
      toiMin: tot.toi / 60,
      toiPerGameMin: tot.gp ? tot.toi / tot.gp / 60 : 0,
      ppGoals: tot.ppGoals,
      ppAssists: tot.ppAssists,
      ppp: tot.ppGoals + tot.ppAssists,
      shGoals: tot.shGoals,
      shAssists: tot.shAssists,
      shp: tot.shGoals + tot.shAssists,
      gwg: tot.gwg,
      p60: tot.toi ? (tot.points * 3600) / tot.toi : 0,
    });
  }

  // Goalies
  const gkByPlayer = new Map<number, typeof allGk>();
  for (const g of allGk) {
    const list = gkByPlayer.get(g.playerId) ?? [];
    list.push(g);
    gkByPlayer.set(g.playerId, list);
  }

  const relevantGoalieIds = new Set<number>();
  for (const g of allGk) {
    if (g.teamId === team.id || rosterIds.has(g.playerId)) {
      relevantGoalieIds.add(g.playerId);
    }
  }

  const goalieRows: GoalieRow[] = [];
  for (const pid of relevantGoalieIds) {
    const rawSplits = gkByPlayer.get(pid) ?? [];
    rawSplits.sort(
      (a, b) =>
        (gkOrderMap.get(`${a.playerId}:${a.teamId}`) ?? 0) -
        (gkOrderMap.get(`${b.playerId}:${b.teamId}`) ?? 0)
    );
    const base = rawSplits[0];
    if (!base) continue;

    const isDeparted = !rosterIds.has(pid);
    const hasSplits =
      rawSplits.length > 1 || (rawSplits.length === 1 && rawSplits[0].teamId !== team.id);

    const tot = {
      gp: 0,
      wins: 0,
      losses: 0,
      otl: 0,
      shutouts: 0,
      shotsAgainst: 0,
      saves: 0,
      goalsAgainst: 0,
      toiMin: 0,
      xga: 0,
      gsax: 0,
      steals: 0,
    };
    for (const sp of rawSplits) {
      tot.gp += sp.gp;
      tot.wins += sp.wins;
      tot.losses += sp.losses;
      tot.otl += sp.otl;
      tot.shutouts += sp.shutouts;
      tot.shotsAgainst += sp.shotsAgainst;
      tot.saves += sp.saves;
      tot.goalsAgainst += sp.goalsAgainst;
      tot.toiMin += sp.toiMin;
      tot.xga += sp.xga;
      tot.gsax += sp.gsax;
      tot.steals += sp.steals;
    }
    const svPct = tot.shotsAgainst ? tot.saves / tot.shotsAgainst : 0;
    const gaa = tot.toiMin ? tot.goalsAgainst / (tot.toiMin / 60) : 0;

    const teamSplit = rawSplits.find((sp) => sp.teamId === team.id);
    const teamForStats = teamSplit
      ? {
          gp: teamSplit.gp,
          wins: teamSplit.wins,
          losses: teamSplit.losses,
          otl: teamSplit.otl,
          shutouts: teamSplit.shutouts,
          shotsAgainst: teamSplit.shotsAgainst,
          saves: teamSplit.saves,
          goalsAgainst: teamSplit.goalsAgainst,
          toiMin: teamSplit.toiMin,
        }
      : {
          gp: 0,
          wins: 0,
          losses: 0,
          otl: 0,
          shutouts: 0,
          shotsAgainst: 0,
          saves: 0,
          goalsAgainst: 0,
          toiMin: 0,
        };

    const splits: GoalieSplitRow[] | undefined = hasSplits
      ? rawSplits.map((sp) => {
          const tInfo = teamMap.get(sp.teamId!);
          return {
            teamId: sp.teamId!,
            teamCode: tInfo?.code ?? "—",
            teamName: tInfo?.name ?? "—",
            teamSlug: tInfo?.slug ?? null,
            gp: sp.gp,
            wins: sp.wins,
            losses: sp.losses,
            otl: sp.otl,
            shutouts: sp.shutouts,
            shotsAgainst: sp.shotsAgainst,
            saves: sp.saves,
            goalsAgainst: sp.goalsAgainst,
            toiMin: sp.toiMin,
            svPct: sp.svPct,
            gaa: sp.gaa,
            xga: sp.xga,
            gsax: sp.gsax,
            steals: sp.steals,
          };
        })
      : undefined;

    goalieRows.push({
      playerId: pid,
      name: base.name,
      slug: base.slug ?? null,
      photoUrl: base.photoUrl ?? null,
      isDeparted,
      hasSplits,
      splits,
      teamForStats,
      gp: tot.gp,
      wins: tot.wins,
      losses: tot.losses,
      otl: tot.otl,
      shutouts: tot.shutouts,
      shotsAgainst: tot.shotsAgainst,
      saves: tot.saves,
      goalsAgainst: tot.goalsAgainst,
      toiMin: tot.toiMin,
      svPct,
      gaa,
      xga: tot.xga,
      gsax: tot.gsax,
      steals: tot.steals,
    });
  }

  return <TeamStatsView skaters={skaterRows} goalies={goalieRows} lang={lang} />;
}
