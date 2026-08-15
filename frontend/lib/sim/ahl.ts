// AHL schedule = a mirror of the NHL schedule: whenever two NHL clubs meet,
// their AHL affiliates meet the same day. Generated from the NHL games.

import { prisma } from "../prisma";

const SEASON = "2026-27";

/** (Re)generate the AHL schedule by mirroring every NHL game onto the affiliates. */
export async function mirrorAhlSchedule(season = SEASON) {
  // NHL team -> its AHL affiliate id
  const affiliates = await prisma.team.findMany({
    where: { league: "AHL", parentTeamId: { not: null } },
    select: { id: true, parentTeamId: true },
  });
  const affOf = new Map<number, number>(affiliates.map((a) => [a.parentTeamId!, a.id]));

  const nhlGames = await prisma.game.findMany({
    where: { season, league: "NHL", seriesId: null },
    select: { round: true, gameDate: true, homeTeamId: true, awayTeamId: true },
    orderBy: { round: "asc" },
  });

  const rows = nhlGames.map((g) => {
    const home = affOf.get(g.homeTeamId);
    const away = affOf.get(g.awayTeamId);
    if (!home || !away) return null;
    return {
      season, league: "AHL", status: "SCHEDULED",
      round: g.round, gameDate: g.gameDate, homeTeamId: home, awayTeamId: away,
    };
  }).filter(Boolean) as Array<{ season: string; league: string; status: string; round: number | null; gameDate: Date | null; homeTeamId: number; awayTeamId: number }>;

  await prisma.game.deleteMany({ where: { season, league: "AHL" } });
  if (rows.length) await prisma.game.createMany({ data: rows });
  return { mirrored: rows.length, affiliates: affOf.size };
}
