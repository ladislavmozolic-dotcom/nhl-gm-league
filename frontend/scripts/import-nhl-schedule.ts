// Import the real NHL 2026-27 regular-season schedule from the NHL API.
//   npx tsx scripts/import-nhl-schedule.ts
//
// Games are stored as SCHEDULED with a real gameDate; `round` is the day index
// (days since opening night) so the CON model gets accurate rest / back-to-backs.

import { prisma } from "../lib/prisma";

const SEASON = "2026-27";
const NHL_SEASON = "20262027";

// NHL abbreviation -> our team name (upper-cased, as stored)
const ABBREV_NAME: Record<string, string> = {
  ANA: "ANAHEIM DUCKS", BOS: "BOSTON BRUINS", BUF: "BUFFALO SABRES", CAR: "CAROLINA HURRICANES",
  CBJ: "COLUMBUS BLUE JACKETS", CGY: "CALGARY FLAMES", CHI: "CHICAGO BLACKHAWKS", COL: "COLORADO AVALANCHE",
  DAL: "DALLAS STARS", DET: "DETROIT RED WINGS", EDM: "EDMONTON OILERS", FLA: "FLORIDA PANTHERS",
  LAK: "LOS ANGELES KINGS", MIN: "MINNESOTA WILD", MTL: "MONTREAL CANADIENS", NJD: "NEW JERSEY DEVILS",
  NSH: "NASHVILLE PREDATORS", NYI: "NEW YORK ISLANDERS", NYR: "NEW YORK RANGERS", OTT: "OTTAWA SENATORS",
  PHI: "PHILADELPHIA FLYERS", PIT: "PITTSBURGH PENGUINS", SEA: "SEATTLE KRAKEN", SJS: "SAN JOSE SHARKS",
  STL: "ST. LOUIS BLUES", TBL: "TAMPA BAY LIGHTNING", TOR: "TORONTO MAPLE LEAFS", UTA: "UTAH MAMMOTH",
  VAN: "VANCOUVER CANUCKS", VGK: "VEGAS GOLDEN KNIGHTS", WPG: "WINNIPEG JETS", WSH: "WASHINGTON CAPITALS",
};

type NhlGame = {
  id: number; gameType: number; gameDate: string;
  awayTeam: { abbrev: string }; homeTeam: { abbrev: string };
};

async function fetchTeamSchedule(abbrev: string): Promise<NhlGame[]> {
  const res = await fetch(`https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/${NHL_SEASON}`);
  if (!res.ok) throw new Error(`${abbrev}: HTTP ${res.status}`);
  const data = await res.json() as { games: NhlGame[] };
  return data.games ?? [];
}

async function main() {
  // map abbrev -> our team id
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, name: true } });
  const nameToId = new Map(teams.map((t) => [t.name.trim().toUpperCase(), t.id]));
  const abbrevToId = new Map<string, number>();
  for (const [ab, name] of Object.entries(ABBREV_NAME)) {
    const id = nameToId.get(name);
    if (!id) { console.warn(`No team for ${ab} (${name})`); continue; }
    abbrevToId.set(ab, id);
  }
  console.log(`Mapped ${abbrevToId.size}/32 teams.`);

  // fetch all schedules, dedupe by game id
  console.log("Fetching NHL schedules...");
  const abbrevs = Object.keys(ABBREV_NAME);
  const byId = new Map<number, NhlGame>();
  for (const ab of abbrevs) {
    const games = await fetchTeamSchedule(ab);
    for (const g of games) if (g.gameType === 2) byId.set(g.id, g);
  }
  const games = [...byId.values()].sort((a, b) => a.gameDate.localeCompare(b.gameDate));
  console.log(`Collected ${games.length} regular-season games.`);

  // day index (round) from opening night
  const firstDate = games[0].gameDate;
  const dayIndex = (d: string) =>
    Math.round((Date.parse(d) - Date.parse(firstDate)) / 86400000);

  const rows = games.map((g) => {
    const homeTeamId = abbrevToId.get(g.homeTeam.abbrev);
    const awayTeamId = abbrevToId.get(g.awayTeam.abbrev);
    if (!homeTeamId || !awayTeamId) return null;
    return {
      season: SEASON, status: "SCHEDULED", round: dayIndex(g.gameDate),
      gameDate: new Date(g.gameDate + "T00:00:00Z"),
      homeTeamId, awayTeamId,
    };
  }).filter(Boolean) as Array<{ season: string; status: string; round: number; gameDate: Date; homeTeamId: number; awayTeamId: number }>;

  // replace the existing season
  const series = await prisma.playoffSeries.findMany({ where: { season: SEASON }, select: { id: true } });
  await prisma.game.deleteMany({ where: { season: SEASON } });
  if (series.length) await prisma.playoffSeries.deleteMany({ where: { season: SEASON } });
  await prisma.player.updateMany({ where: { isGoalie: true, team: { league: "NHL" } }, data: { condition: 100 } });
  await prisma.player.updateMany({ where: { team: { league: "NHL" } }, data: { injuryDaysLeft: 0, injuryDesc: null } });
  await prisma.game.createMany({ data: rows });

  const lastDate = games[games.length - 1].gameDate;
  console.log(`Imported ${rows.length} games across ${dayIndex(lastDate) + 1} days (${firstDate} → ${lastDate}).`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
