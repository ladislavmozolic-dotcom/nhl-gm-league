import * as cheerio from "cheerio";

import { prisma } from "@/lib/prisma";
import { resolveWorldPlayer } from "@/lib/world-player-identity";

const BASE_URL = "https://www.collegehockeynews.com";
const USER_AGENT = "UNHL Around-the-World/1.0 (+https://unhl.eu)";

type Team = { id: string; slug: string; name: string };
type ImportedPlayer = {
  sourceId: string;
  name: string;
  position: string | null;
  team: Team;
  goalie: boolean;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number | null;
  penaltyMinutes: number;
  wins: number | null;
  losses: number | null;
  overtimeLosses: number | null;
  savePercentage: number | null;
  goalsAgainstAverage: number | null;
};

const integer = (value: string | undefined) => Number.parseInt(value?.replace(/[^0-9-]/g, "") ?? "0", 10) || 0;
const decimal = (value: string | undefined) => {
  const parsed = Number.parseFloat(value?.replace(/[^0-9.]/g, "") ?? "");
  return Number.isFinite(parsed) ? parsed : null;
};

async function page(path: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`College Hockey News returned ${response.status} for ${path}.`);
  return response.text();
}

function currentSeason() {
  const now = new Date();
  const year = now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0);
  return { id: `${year}${year + 1}`, label: `${year}-${String(year + 1).slice(2)}` };
}

function parseTeams(html: string) {
  const $ = cheerio.load(html);
  const teams = new Map<string, Team>();
  $("a[href^='/stats/team/']").each((_, link) => {
    const href = $(link).attr("href") ?? "";
    const match = href.match(/^\/stats\/team\/([^/]+)\/(\d+)$/);
    if (!match) return;
    const name = $(link).text().trim();
    if (name) teams.set(match[2], { slug: match[1], id: match[2], name });
  });
  return [...teams.values()];
}

function playerId(href: string | undefined) {
  return href?.match(/\/players\/career\/[^/]+\/(\d+)/)?.[1] ?? null;
}

function parseTeamStats(html: string, team: Team) {
  const $ = cheerio.load(html);
  const players: ImportedPlayer[] = [];
  $("#skaters tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    const link = cells.eq(0).find("a").first();
    const sourceId = playerId(link.attr("href"));
    const name = link.text().trim();
    if (!sourceId || !name) return;
    const description = cells.eq(0).text();
    const position = description.match(/,\s*([FDC])\s*,/i)?.[1]?.toUpperCase() ?? null;
    players.push({
      sourceId, name, position, team, goalie: false,
      gamesPlayed: integer(cells.eq(1).text()), goals: integer(cells.eq(2).text()), assists: integer(cells.eq(3).text()), points: integer(cells.eq(4).text()),
      penaltyMinutes: integer(cells.eq(8).text()), plusMinus: integer(cells.eq(12).text()),
      wins: null, losses: null, overtimeLosses: null, savePercentage: null, goalsAgainstAverage: null,
    });
  });
  $("#goalies tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    const link = cells.eq(0).find("a").first();
    const sourceId = playerId(link.attr("href"));
    const name = link.text().trim();
    if (!sourceId || !name) return;
    players.push({
      sourceId, name, position: "G", team, goalie: true,
      gamesPlayed: integer(cells.eq(1).text()), goals: 0, assists: 0, points: 0, plusMinus: null, penaltyMinutes: 0,
      wins: integer(cells.eq(2).text()), losses: integer(cells.eq(3).text()), overtimeLosses: integer(cells.eq(4).text()),
      goalsAgainstAverage: decimal(cells.eq(6).text()), savePercentage: decimal(cells.eq(9).text()),
    });
  });
  return players;
}

async function importSeason(season: { id: string; label: string }, teams: Team[], leagueId: number) {
  const imported: ImportedPlayer[] = [];
  // Eight simultaneous pages keeps a full Division I refresh quick while being
  // respectful of the public source.
  for (let offset = 0; offset < teams.length; offset += 8) {
    const batch = await Promise.all(teams.slice(offset, offset + 8).map(async (team) => {
      const html = await page(`/stats/team/${team.slug}/${team.id}/overall,${season.id}`);
      return parseTeamStats(html, team);
    }));
    imported.push(...batch.flat());
  }
  if (!imported.length) return { players: [], teams: new Map<string, number>() };

  const savedTeams = new Map<string, number>();
  for (const team of teams) {
    const saved = await prisma.worldTeam.upsert({
      where: { leagueId_externalId: { leagueId, externalId: `chn:${team.id}` } },
      update: { name: team.name, slug: team.slug },
      create: { leagueId, externalId: `chn:${team.id}`, name: team.name, slug: team.slug },
    });
    savedTeams.set(team.id, saved.id);
  }
  return { players: imported, teams: savedTeams };
}

/** Import every NCAA Division I skater and goalie. College Hockey News publishes
 * complete team stat tables, including players outside the national leaderboards.
 * A new NCAA season deliberately remains empty until its first real stats land. */
export async function importNcaaSeason() {
  const league = await prisma.worldLeague.upsert({
    where: { code: "NCAA" }, update: {},
    create: { code: "NCAA", name: "NCAA Division I", country: "USA", region: "North America" },
  });
  const teams = parseTeams(await page("/stats/"));
  if (!teams.length) throw new Error("NCAA team directory returned no Division I teams.");

  const season = currentSeason();
  const result = await importSeason(season, teams, league.id);
  if (!result.players.length) return { season: season.label, teams: teams.length, players: 0, goalies: 0, linked: 0 };

  let linked = 0;
  for (const entry of result.players) {
    const { player, owned } = await resolveWorldPlayer({
      provider: "collegehockeynews", externalId: entry.sourceId, name: entry.name,
      position: entry.position, currentTeamId: result.teams.get(entry.team.id) ?? null,
    });
    await prisma.worldPlayerSeasonStat.upsert({
      where: { playerId_leagueId_season: { playerId: player.id, leagueId: league.id, season: season.label } },
      update: {
        teamId: result.teams.get(entry.team.id) ?? null, isGoalie: entry.goalie, gamesPlayed: entry.gamesPlayed,
        goals: entry.goals, assists: entry.assists, points: entry.points, plusMinus: entry.plusMinus, penaltyMinutes: entry.penaltyMinutes,
        wins: entry.wins, losses: entry.losses, overtimeLosses: entry.overtimeLosses, savePercentage: entry.savePercentage,
        goalsAgainstAverage: entry.goalsAgainstAverage, shutouts: null, source: "collegehockeynews", syncedAt: new Date(),
      },
      create: {
        playerId: player.id, leagueId: league.id, teamId: result.teams.get(entry.team.id) ?? null, season: season.label,
        isGoalie: entry.goalie, gamesPlayed: entry.gamesPlayed, goals: entry.goals, assists: entry.assists, points: entry.points,
        plusMinus: entry.plusMinus, penaltyMinutes: entry.penaltyMinutes, wins: entry.wins, losses: entry.losses,
        overtimeLosses: entry.overtimeLosses, savePercentage: entry.savePercentage, goalsAgainstAverage: entry.goalsAgainstAverage,
        shutouts: null, source: "collegehockeynews",
      },
    });
    if (owned) linked++;
  }
  return { season: season.label, teams: result.teams.size, players: result.players.length, goalies: result.players.filter((player) => player.goalie).length, linked };
}
