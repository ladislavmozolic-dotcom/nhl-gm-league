/**
 * DEL (Deutsche Eishockey Liga) full league importer via EliteProspects.
 *
 * Strategy:
 *   1. Scrape each DEL team roster page on EP to get all players + EP URLs
 *   2. For each player, call the EP player scraper to get 2026-27 stats
 *   3. Upsert WorldLeague, WorldTeam, WorldPlayer, WorldPlayerSeasonStat
 *
 * All 14 official DEL clubs (2026-27 season) from EliteProspects.
 */

import { prisma } from "@/lib/prisma";
import { resolveWorldPlayer } from "@/lib/world-player-identity";
import { scrapeEpPlayer, mapEpLeagueToCode } from "@/lib/ep-scraper";
import { epSearchName } from "@/lib/playerName";

const norm = (s: string) =>
  epSearchName(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// All 14 active DEL teams (2026-27) with exact EP team IDs and slugs
export const DEL_TEAMS: [number, string, string][] = [
  [119,  "adler-mannheim",           "Adler Mannheim"],
  [120,  "augsburger-panther",       "Augsburger Panther"],
  [122,  "eisbaren-berlin",          "Eisbären Berlin"],
  [133,  "dusseldorfer-eg",          "Düsseldorfer EG"],
  [445,  "erc-ingolstadt",           "ERC Ingolstadt"],
  [441,  "fischtown-pinguins",       "Fischtown Pinguins"],
  [975,  "grizzlys-wolfsburg",       "Grizzlys Wolfsburg"],
  [475,  "iserlohn-roosters",        "Iserlohn Roosters"],
  [128,  "kolner-haie",              "Kölner Haie"],
  [5065, "lowen-frankfurt",          "Löwen Frankfurt"],
  [130,  "nurnberg-ice-tigers",      "Nürnberg Ice Tigers"],
  [981,  "ehc-munchen",              "EHC Red Bull München"],
  [132,  "schwenninger-wild-wings",  "Schwenninger Wild Wings"],
  [447,  "straubing-tigers",         "Straubing Tigers"],
];

const EP_BASE = "https://www.eliteprospects.com";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Fetch a DEL team roster from EP team page via the ep-roster-server HTTP proxy.
 */
async function fetchDelTeamRoster(
  teamId: number,
  teamSlug: string
): Promise<{ epUrl: string; name: string; position: string; epId: string }[]> {
  const url = `${EP_BASE}/team/${teamId}/${teamSlug}/2026-2027`;
  const encoded = encodeURIComponent(url);

  const endpoints = [
    `http://172.18.0.1:3336/roster?url=${encoded}`,
    `http://172.17.0.1:3336/roster?url=${encoded}`,
    `http://127.0.0.1:3336/roster?url=${encoded}`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        success: boolean;
        players?: { epUrl: string; name: string; position: string; epId: string }[];
      };
      if (data.success && data.players && data.players.length > 0) return data.players;
    } catch {
      continue;
    }
  }
  return [];
}

export async function importDelLeague(): Promise<{
  league: string;
  teams: number;
  statLines: number;
  players: number;
}> {
  const delLeague = await prisma.worldLeague.upsert({
    where: { code: "DEL" },
    update: { active: true },
    create: {
      code: "DEL",
      name: "Deutsche Eishockey Liga",
      country: "Germany",
      region: "Europe",
      active: true,
    },
  });

  let statLines = 0;
  let totalPlayers = 0;
  let teamsProcessed = 0;

  for (const [teamId, teamSlug, teamName] of DEL_TEAMS) {
    try {
      const roster = await fetchDelTeamRoster(teamId, teamSlug);
      if (!roster.length) continue;

      const teamSlugNorm = norm(teamName).replace(/ /g, "-");
      const worldTeam = await prisma.worldTeam.upsert({
        where: { leagueId_slug: { leagueId: delLeague.id, slug: teamSlugNorm } },
        update: { name: teamName, externalId: String(teamId) },
        create: { leagueId: delLeague.id, slug: teamSlugNorm, name: teamName, externalId: String(teamId) },
      });

      teamsProcessed++;

      // Process players in concurrent batches of 3
      await mapPool(roster, 3, async (pl) => {
        try {
          await sleep(150 + Math.random() * 250);
          const epResult = await scrapeEpPlayer(`${EP_BASE}${pl.epUrl}`);
          if (!epResult.success) return;

          totalPlayers++;
          const isGoalie = (epResult.position || pl.position || "").toUpperCase() === "G";

          const { player } = await resolveWorldPlayer({
            provider: "ep-scraper",
            externalId: String(epResult.epId),
            name: pl.name,
            position: epResult.position || pl.position || null,
            currentTeamId: worldTeam.id,
          });

          // Ensure epUrl is stored directly on worldPlayer
          const epFullUrl = `${EP_BASE}${pl.epUrl}`;
          await prisma.worldPlayer.update({
            where: { id: player.id },
            data: { epUrl: epFullUrl },
          });

          if (epResult.season2627) {
            const s = epResult.season2627;
            const leagueCode = mapEpLeagueToCode(s.leagueName, s.leagueUrlPath);

            if (leagueCode === "DEL" || (s.leagueUrlPath && s.leagueUrlPath.toLowerCase().includes("del"))) {
              const statTeamName = s.teamName ?? teamName;
              const statTeamSlug = norm(statTeamName).replace(/ /g, "-");
              const statTeam = await prisma.worldTeam.upsert({
                where: { leagueId_slug: { leagueId: delLeague.id, slug: statTeamSlug } },
                update: { name: statTeamName },
                create: { leagueId: delLeague.id, slug: statTeamSlug, name: statTeamName },
              });

              await prisma.worldPlayerSeasonStat.upsert({
                where: {
                  playerId_leagueId_season: {
                    playerId: player.id,
                    leagueId: delLeague.id,
                    season: "2026-27",
                  },
                },
                update: {
                  teamId: statTeam.id,
                  isGoalie,
                  gamesPlayed: s.gp,
                  goals: s.g,
                  assists: s.a,
                  points: s.pts,
                  plusMinus: s.pm ?? null,
                  penaltyMinutes: s.pim,
                  wins: isGoalie ? (s.w ?? null) : null,
                  losses: isGoalie ? (s.l ?? null) : null,
                  savePercentage: isGoalie ? (s.svp ?? null) : null,
                  goalsAgainstAverage: isGoalie ? (s.gaa ?? null) : null,
                  shutouts: isGoalie ? (s.so ?? null) : null,
                  source: "ep-scraper",
                  syncedAt: new Date(),
                },
                create: {
                  playerId: player.id,
                  leagueId: delLeague.id,
                  teamId: statTeam.id,
                  season: "2026-27",
                  isGoalie,
                  gamesPlayed: s.gp,
                  goals: s.g,
                  assists: s.a,
                  points: s.pts,
                  plusMinus: s.pm ?? null,
                  penaltyMinutes: s.pim,
                  wins: isGoalie ? (s.w ?? null) : null,
                  losses: isGoalie ? (s.l ?? null) : null,
                  savePercentage: isGoalie ? (s.svp ?? null) : null,
                  goalsAgainstAverage: isGoalie ? (s.gaa ?? null) : null,
                  shutouts: isGoalie ? (s.so ?? null) : null,
                  source: "ep-scraper",
                },
              });

              statLines++;
            }
          }

          // Link any matching prospect
          const epFullUrlProspect = `${EP_BASE}${pl.epUrl}`;
          const prospect = await prisma.prospect.findFirst({
            where: {
              OR: [
                { epUrl: epFullUrlProspect },
                { epUrl: `${EP_BASE}/player/${epResult.epId}` },
                { epUrl: { contains: `/player/${epResult.epId}/` } },
                { epUrl: { contains: `/player/${epResult.epId}` } },
              ],
              worldPlayerId: null,
            },
          });
          if (prospect) {
            await prisma.prospect.update({ where: { id: prospect.id }, data: { worldPlayerId: player.id } });
          }
        } catch {
          // ignore individual player failure
        }
      });
    } catch {
      // ignore team-level failure
    }
  }

  return { league: "DEL", teams: teamsProcessed, statLines, players: totalPlayers };
}
