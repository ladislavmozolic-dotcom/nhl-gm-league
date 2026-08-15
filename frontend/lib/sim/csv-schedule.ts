// Import a schedule from a CSV file (admin upload). Columns: date, away, home.
// `date` = YYYY-MM-DD; `away`/`home` = NHL abbrev (TOR, MTL, …) or full team name.

import { prisma } from "../prisma";
import { mirrorAhlSchedule } from "./ahl";

const SEASON = "2026-27";

// NHL abbreviation -> our team name (upper-cased, as stored)
export const ABBREV_NAME: Record<string, string> = {
  ANA: "ANAHEIM DUCKS", BOS: "BOSTON BRUINS", BUF: "BUFFALO SABRES", CAR: "CAROLINA HURRICANES",
  CBJ: "COLUMBUS BLUE JACKETS", CGY: "CALGARY FLAMES", CHI: "CHICAGO BLACKHAWKS", COL: "COLORADO AVALANCHE",
  DAL: "DALLAS STARS", DET: "DETROIT RED WINGS", EDM: "EDMONTON OILERS", FLA: "FLORIDA PANTHERS",
  LAK: "LOS ANGELES KINGS", MIN: "MINNESOTA WILD", MTL: "MONTREAL CANADIENS", NJD: "NEW JERSEY DEVILS",
  NSH: "NASHVILLE PREDATORS", NYI: "NEW YORK ISLANDERS", NYR: "NEW YORK RANGERS", OTT: "OTTAWA SENATORS",
  PHI: "PHILADELPHIA FLYERS", PIT: "PITTSBURGH PENGUINS", SEA: "SEATTLE KRAKEN", SJS: "SAN JOSE SHARKS",
  STL: "ST. LOUIS BLUES", TBL: "TAMPA BAY LIGHTNING", TOR: "TORONTO MAPLE LEAFS", UTA: "UTAH MAMMOTH",
  VAN: "VANCOUVER CANUCKS", VGK: "VEGAS GOLDEN KNIGHTS", WPG: "WINNIPEG JETS", WSH: "WASHINGTON CAPITALS",
};

/** A downloadable template with the header and a couple of example rows. */
export function scheduleTemplateCsv(): string {
  return [
    "date,away,home",
    "2026-09-29,MTL,TOR",
    "2026-09-30,CHI,FLA",
    "2026-09-30,PIT,NYR",
    "# date = YYYY-MM-DD; away/home = NHL abbreviation (TOR, MTL, …) or full team name",
  ].join("\n") + "\n";
}

type ParsedRow = { date: string; away: string; home: string; line: number };

function parseCsv(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("#")) continue;
    const cells = raw.split(",").map((c) => c.trim());
    if (i === 0 && /date/i.test(cells[0])) continue; // header
    if (cells.length < 3) continue;
    const [date, away, home] = cells;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    rows.push({ date, away, home, line: i + 1 });
  }
  return rows;
}

export type ScheduleRow = { season: string; status: string; round: number; gameDate: Date; homeTeamId: number; awayTeamId: number };
export type CsvImportResult = { imported: number; days: number; errors: string[] };

/** Wipe the season's games/playoffs, reset CON/injuries, insert new games. */
async function replaceSeasonGames(season: string, rows: ScheduleRow[]) {
  const series = await prisma.playoffSeries.findMany({ where: { season }, select: { id: true } });
  await prisma.game.deleteMany({ where: { season } });
  if (series.length) await prisma.playoffSeries.deleteMany({ where: { season } });
  await prisma.player.updateMany({ where: { isGoalie: true, team: { league: "NHL" } }, data: { condition: 100 } });
  await prisma.player.updateMany({ where: { team: { league: "NHL" } }, data: { injuryDaysLeft: 0, injuryDesc: null } });
  await prisma.game.createMany({ data: rows });
}

/** Import the real schedule straight from the NHL API for a given season. */
export async function importFromNhlApi(season = SEASON, nhlSeason = "20262027"): Promise<CsvImportResult> {
  const byId = new Map<number, { gameDate: string; awayAbbrev: string; homeAbbrev: string }>();
  for (const ab of Object.keys(ABBREV_NAME)) {
    const res = await fetch(`https://api-web.nhle.com/v1/club-schedule-season/${ab}/${nhlSeason}`);
    if (!res.ok) return { imported: 0, days: 0, errors: [`NHL API error for ${ab}: HTTP ${res.status}`] };
    const data = await res.json() as { games?: Array<{ id: number; gameType: number; gameDate: string; awayTeam: { abbrev: string }; homeTeam: { abbrev: string } }> };
    for (const g of data.games ?? []) if (g.gameType === 2) byId.set(g.id, { gameDate: g.gameDate, awayAbbrev: g.awayTeam.abbrev, homeAbbrev: g.homeTeam.abbrev });
  }
  const csv = "date,away,home\n" + [...byId.values()]
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate))
    .map((g) => `${g.gameDate},${g.awayAbbrev},${g.homeAbbrev}`).join("\n");
  return importCsvSchedule(csv, season);
}

export async function importCsvSchedule(text: string, season = SEASON): Promise<CsvImportResult> {
  const parsed = parseCsv(text);
  if (!parsed.length) return { imported: 0, days: 0, errors: ["No valid rows found. Expected: date,away,home"] };

  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, name: true } });
  const nameToId = new Map(teams.map((t) => [t.name.trim().toUpperCase(), t.id]));
  const resolve = (key: string): number | null => {
    const k = key.trim().toUpperCase();
    if (ABBREV_NAME[k]) return nameToId.get(ABBREV_NAME[k]) ?? null;
    return nameToId.get(k) ?? null;
  };

  const errors: string[] = [];
  const sorted = [...parsed].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = sorted[0].date;
  const dayIndex = (d: string) => Math.round((Date.parse(d) - Date.parse(firstDate)) / 86400000);

  const rows = sorted.map((r) => {
    const homeTeamId = resolve(r.home);
    const awayTeamId = resolve(r.away);
    if (!homeTeamId || !awayTeamId) {
      errors.push(`Line ${r.line}: unknown team "${!homeTeamId ? r.home : r.away}"`);
      return null;
    }
    return {
      season, status: "SCHEDULED", round: dayIndex(r.date),
      gameDate: new Date(r.date + "T00:00:00Z"), homeTeamId, awayTeamId,
    };
  }).filter(Boolean) as Array<{ season: string; status: string; round: number; gameDate: Date; homeTeamId: number; awayTeamId: number }>;

  if (!rows.length) return { imported: 0, days: 0, errors: errors.length ? errors : ["No rows could be mapped to teams."] };

  await replaceSeasonGames(season, rows);
  await mirrorAhlSchedule(season); // AHL affiliates mirror the NHL schedule
  const days = Math.max(...rows.map((r) => r.round)) + 1;
  return { imported: rows.length, days, errors: errors.slice(0, 10) };
}
