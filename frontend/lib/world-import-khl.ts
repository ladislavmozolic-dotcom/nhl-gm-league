/**
 * KHL (Kontinental Hockey League) full league importer via EliteProspects.
 *
 * Strategy:
 *   1. Scrape each KHL team roster page on EP to get all players + EP URLs
 *   2. For each player, call the EP player scraper to get 2026-27 stats
 *   3. Upsert WorldLeague, WorldTeam, WorldPlayer, WorldPlayerSeasonStat
 *
 * All 22 official KHL clubs (2026-27 season) from EliteProspects standings.
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

// All 22 active KHL teams (2026-27) with exact EP team IDs and slugs
const KHL_TEAMS: [number, string, string][] = [
  [193,   "metallurg-magnitogorsk",     "Metallurg Magnitogorsk"],
  [196,   "neftekhimik-nizhnekamsk",    "Neftekhimik Nizhnekamsk"],
  [197,   "salavat-yulaev-ufa",         "Salavat Yulaev Ufa"],
  [184,   "ak-bars-kazan",              "Ak Bars Kazan"],
  [2498,  "barys-astana",               "Barys Astana"],
  [185,   "amur-khabarovsk",            "Amur Khabarovsk"],
  [1724,  "avtomobilist-yekaterinburg", "Avtomobilist Yekaterinburg"],
  [186,   "avangard-omsk",              "Avangard Omsk"],
  [15082, "admiral-vladivostok",        "Admiral Vladivostok"],
  [1003,  "sibir-novosibirsk",          "Sibir Novosibirsk"],
  [1679,  "traktor-chelyabinsk",        "Traktor Chelyabinsk"],
  [191,   "lokomotiv-yaroslavl",        "Lokomotiv Yaroslavl"],
  [187,   "cska-moskva",                "CSKA Moskva"],
  [199,   "ska-st-petersburg",          "SKA St. Petersburg"],
  [200,   "torpedo-nizhny-novgorod",    "Torpedo Nizhny Novgorod"],
  [775,   "spartak-moskva",             "Spartak Moskva"],
  [6815,  "dynamo-moskva",              "Dynamo Moskva"],
  [22214, "shanghai-dragons",           "Shanghai Dragons"],
  [1678,  "dinamo-minsk",               "Dinamo Minsk"],
  [198,   "severstal-cherepovets",      "Severstal Cherepovets"],
  [189,   "lada-togliatti",             "Lada Togliatti"],
  [17166, "hk-sochi",                   "HK Sochi"],
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
 * Fetch a KHL team roster from EP team page via the ep-roster-server HTTP proxy.
 */
async function fetchKhlTeamRoster(
  teamId: number,
  teamSlug: string
): Promise<{ epUrl: string; name: string; position: string; epId: string; dateOfBirth?: string | null }[]> {
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
        players?: { epUrl: string; name: string; position: string; epId: string; dateOfBirth?: string | null }[];
      };
      if (data.success && data.players && data.players.length > 0) return data.players;
    } catch {
      continue;
    }
  }
  return [];
}

export async function importKhlLeague(): Promise<{
  league: string;
  teams: number;
  statLines: number;
  players: number;
}> {
  const khlLeague = await prisma.worldLeague.upsert({
    where: { code: "KHL" },
    update: { active: true },
    create: {
      code: "KHL",
      name: "Kontinental Hockey League",
      country: "Russia",
      region: "Europe",
      active: true,
    },
  });

  let statLines = 0;
  let totalPlayers = 0;
  let teamsProcessed = 0;

  for (const [teamId, teamSlug, teamName] of KHL_TEAMS) {
    try {
      const roster = await fetchKhlTeamRoster(teamId, teamSlug);
      if (!roster.length) continue;

      const teamSlugNorm = norm(teamName).replace(/ /g, "-");
      const worldTeam = await prisma.worldTeam.upsert({
        where: { leagueId_slug: { leagueId: khlLeague.id, slug: teamSlugNorm } },
        update: { name: teamName },
        create: { leagueId: khlLeague.id, slug: teamSlugNorm, name: teamName },
      });

      teamsProcessed++;

      // Process players in concurrent batches of 3
      await mapPool(roster, 3, async (pl) => {
        try {
          await sleep(200 + Math.random() * 300);
          const epResult = await scrapeEpPlayer(`${EP_BASE}${pl.epUrl}`);
          if (!epResult.success) return;

          totalPlayers++;
          const isGoalie = (epResult.position || pl.position || "").toUpperCase() === "G";
          const birthDate = epResult.dateOfBirth || pl.dateOfBirth || null;
          const epFullUrl = `${EP_BASE}${pl.epUrl}`;

          const { player } = await resolveWorldPlayer({
            provider: "ep-scraper",
            externalId: String(epResult.epId),
            name: pl.name,
            position: epResult.position || pl.position || null,
            birthDate,
            epUrl: epFullUrl,
            currentTeamId: worldTeam.id,
          });

          await prisma.worldPlayer.update({
            where: { id: player.id },
            data: {
              epUrl: epFullUrl,
              ...(birthDate ? { birthDate } : {}),
            },
          });

          if (epResult.season2627) {
            const s = epResult.season2627;
            const leagueCode = mapEpLeagueToCode(s.leagueName, s.leagueUrlPath);

            // Store stats for KHL, VHL, MHL or other Russian competitions
            if (["KHL", "VHL", "MHL"].includes(leagueCode) || leagueCode.startsWith("RUS")) {
              const targetLeague =
                leagueCode === "KHL"
                  ? khlLeague
                  : await prisma.worldLeague.upsert({
                      where: { code: leagueCode },
                      update: { active: true },
                      create: {
                        code: leagueCode,
                        name: s.leagueName ?? leagueCode,
                        country: "Russia",
                        region: "Europe",
                        active: true,
                      },
                    });

              const statTeamName = s.teamName ?? teamName;
              const statTeamSlug = norm(statTeamName).replace(/ /g, "-");
              const statTeam = await prisma.worldTeam.upsert({
                where: { leagueId_slug: { leagueId: targetLeague.id, slug: statTeamSlug } },
                update: { name: statTeamName },
                create: { leagueId: targetLeague.id, slug: statTeamSlug, name: statTeamName },
              });

              await prisma.worldPlayerSeasonStat.upsert({
                where: {
                  playerId_leagueId_season: {
                    playerId: player.id,
                    leagueId: targetLeague.id,
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
                  leagueId: targetLeague.id,
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
          const prospect = await prisma.prospect.findFirst({
            where: {
              OR: [
                { epUrl: epFullUrl },
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

  return { league: "KHL", teams: teamsProcessed, statLines, players: totalPlayers };
}
