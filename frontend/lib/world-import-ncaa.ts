import * as cheerio from "cheerio";

import { prisma } from "@/lib/prisma";
import { resolveWorldPlayer } from "@/lib/world-player-identity";

const BASE_URL = "https://www.collegehockeynews.com";
const USER_AGENT = "UNHL Around-the-World/1.0 (+https://unhl.eu)";

type Team = { id: string; slug: string; name: string; logoUrl?: string | null };

type ImportedPlayer = {
  sourceId: string;
  name: string;
  position: string | null;
  birthDate?: string | null;
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
  shutouts: number | null;
};

const integer = (value: string | undefined) => Number.parseInt(value?.replace(/[^0-9-]/g, "") ?? "0", 10) || 0;
const decimal = (value: string | undefined) => {
  const parsed = Number.parseFloat(value?.replace(/[^0-9.]/g, "") ?? "");
  return Number.isFinite(parsed) ? parsed : null;
};

async function page(path: string): Promise<string> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`College Hockey News returned ${response.status} for ${path}.`);
  return response.text();
}

function parseTeams(html: string): Team[] {
  const $ = cheerio.load(html);
  const teams = new Map<string, Team>();
  $("a.team[href^='/reports/team/']").each((_, link) => {
    const href = $(link).attr("href") ?? "";
    const match = href.match(/^\/reports\/team\/([^/]+)\/(\d+)$/);
    if (!match) return;
    const name = $(link).text().trim();
    const slug = match[1];
    const id = match[2];
    const logo = $(link).prev().find("img").attr("src");
    const logoUrl = logo ? (logo.startsWith("http") ? logo : `${BASE_URL}${logo}`) : null;
    if (name && id) teams.set(id, { slug, id, name, logoUrl });
  });
  return [...teams.values()];
}

function playerId(href: string | undefined): string | null {
  return href?.match(/\/players\/career\/[^/]+\/(\d+)/)?.[1] ?? null;
}

function parseTeamRoster(html: string): Map<string, { birthDate: string | null; position: string | null }> {
  const $ = cheerio.load(html);
  const players = new Map<string, { birthDate: string | null; position: string | null }>();
  $("table tbody tr").each((_, row) => {
    const link = $(row).find("a[href^='/players/career/']").first();
    const id = playerId(link.attr("href"));
    if (!id) return;
    const dobCell = $(row).find("td[data-text]").filter((_, el) => /^\d{4}-\d{2}-\d{2}$/.test($(el).attr("data-text") || ""));
    const birthDate = dobCell.attr("data-text") || null;
    const posCell = $(row).find("td[data-text]").filter((_, el) => /^[FDCG]$/i.test($(el).attr("data-text") || ""));
    const position = posCell.attr("data-text")?.toUpperCase() || null;
    players.set(id, { birthDate, position });
  });
  return players;
}

function parseTeamStats(html: string, team: Team, rosterMeta: Map<string, { birthDate: string | null; position: string | null }>): ImportedPlayer[] {
  const $ = cheerio.load(html);
  const players: ImportedPlayer[] = [];

  $("#skaters tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    const link = cells.eq(0).find("a").first();
    const sourceId = playerId(link.attr("href"));
    const name = link.text().trim();
    if (!sourceId || !name) return;
    const description = cells.eq(0).text();
    const posFromDesc = description.match(/,\s*([FDC])\s*,/i)?.[1]?.toUpperCase() ?? null;
    const meta = rosterMeta.get(sourceId);
    const position = meta?.position || posFromDesc;

    players.push({
      sourceId,
      name,
      position,
      birthDate: meta?.birthDate ?? null,
      team,
      goalie: false,
      gamesPlayed: integer(cells.eq(1).text()),
      goals: integer(cells.eq(2).text()),
      assists: integer(cells.eq(3).text()),
      points: integer(cells.eq(4).text()),
      penaltyMinutes: integer(cells.eq(8).text()),
      plusMinus: integer(cells.eq(12).text()),
      wins: null,
      losses: null,
      overtimeLosses: null,
      savePercentage: null,
      goalsAgainstAverage: null,
      shutouts: null,
    });
  });

  $("#goalies tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    const link = cells.eq(0).find("a").first();
    const sourceId = playerId(link.attr("href"));
    const name = link.text().trim();
    if (!sourceId || !name) return;
    const meta = rosterMeta.get(sourceId);

    players.push({
      sourceId,
      name,
      position: "G",
      birthDate: meta?.birthDate ?? null,
      team,
      goalie: true,
      gamesPlayed: integer(cells.eq(1).text()),
      goals: 0,
      assists: 0,
      points: 0,
      plusMinus: null,
      penaltyMinutes: 0,
      wins: integer(cells.eq(2).text()),
      losses: integer(cells.eq(3).text()),
      overtimeLosses: integer(cells.eq(4).text()),
      goalsAgainstAverage: decimal(cells.eq(7).text()),
      shutouts: integer(cells.eq(8).text()),
      savePercentage: decimal(cells.eq(10).text()),
    });
  });

  return players;
}

/** Import NCAA Division I skaters and goalies, their active stats, rosters, and college teams. */
export async function importNcaaSeason() {
  const league = await prisma.worldLeague.upsert({
    where: { code: "NCAA" },
    update: { logoUrl: "/images/leagues/ncaa.svg", active: true },
    create: { code: "NCAA", name: "NCAA Division I", country: "USA", region: "North America", logoUrl: "/images/leagues/ncaa.svg", active: true },
  });

  const teams = parseTeams(await page("/stats/"));
  if (!teams.length) throw new Error("NCAA team directory returned no Division I teams.");

  const savedTeams = new Map<string, number>();
  for (const team of teams) {
    const saved = await prisma.worldTeam.upsert({
      where: { leagueId_externalId: { leagueId: league.id, externalId: `chn:${team.id}` } },
      update: { name: team.name, slug: team.slug, ...(team.logoUrl ? { logoUrl: team.logoUrl } : {}) },
      create: { leagueId: league.id, externalId: `chn:${team.id}`, name: team.name, slug: team.slug, logoUrl: team.logoUrl },
    });
    savedTeams.set(team.id, saved.id);
  }

  const allPlayers: ImportedPlayer[] = [];

  // Concurrently fetch team rosters and stats pages (8 teams in parallel)
  for (let offset = 0; offset < teams.length; offset += 8) {
    const batch = teams.slice(offset, offset + 8);
    const batchResults = await Promise.all(
      batch.map(async (team) => {
        try {
          const [statsHtml, rosterHtml] = await Promise.all([
            page(`/stats/team/${team.slug}/${team.id}`).catch(() => ""),
            page(`/reports/roster/${team.slug}/${team.id}`).catch(() => ""),
          ]);
          const rosterMeta = rosterHtml ? parseTeamRoster(rosterHtml) : new Map();
          if (statsHtml) {
            return parseTeamStats(statsHtml, team, rosterMeta);
          }
          return [];
        } catch {
          return [];
        }
      })
    );
    allPlayers.push(...batchResults.flat());
  }

  const seasonName = "2026-27";
  let linked = 0;
  let statsCreated = 0;

  for (const entry of allPlayers) {
    const teamDbId = savedTeams.get(entry.team.id) ?? null;
    const { player, owned } = await resolveWorldPlayer({
      provider: "collegehockeynews",
      externalId: entry.sourceId,
      name: entry.name,
      position: entry.position,
      birthDate: entry.birthDate,
      currentTeamId: teamDbId,
    });
    if (owned) linked++;

    await prisma.worldPlayerSeasonStat.upsert({
      where: {
        playerId_leagueId_season: {
          playerId: player.id,
          leagueId: league.id,
          season: seasonName,
        },
      },
      update: {
        teamId: teamDbId,
        isGoalie: entry.goalie,
        gamesPlayed: entry.gamesPlayed,
        goals: entry.goals,
        assists: entry.assists,
        points: entry.points,
        plusMinus: entry.goalie ? null : entry.plusMinus,
        penaltyMinutes: entry.penaltyMinutes,
        wins: entry.wins,
        losses: entry.losses,
        overtimeLosses: entry.overtimeLosses,
        savePercentage: entry.savePercentage,
        goalsAgainstAverage: entry.goalsAgainstAverage,
        shutouts: entry.shutouts,
        source: "official-feed",
        syncedAt: new Date(),
      },
      create: {
        playerId: player.id,
        leagueId: league.id,
        teamId: teamDbId,
        season: seasonName,
        isGoalie: entry.goalie,
        gamesPlayed: entry.gamesPlayed,
        goals: entry.goals,
        assists: entry.assists,
        points: entry.points,
        plusMinus: entry.goalie ? null : entry.plusMinus,
        penaltyMinutes: entry.penaltyMinutes,
        wins: entry.wins,
        losses: entry.losses,
        overtimeLosses: entry.overtimeLosses,
        savePercentage: entry.savePercentage,
        goalsAgainstAverage: entry.goalsAgainstAverage,
        shutouts: entry.shutouts,
        source: "official-feed",
      },
    });
    statsCreated++;
  }

  return {
    season: seasonName,
    teams: savedTeams.size,
    players: allPlayers.length,
    goalies: allPlayers.filter((p) => p.goalie).length,
    statsCreated,
    linked,
  };
}
