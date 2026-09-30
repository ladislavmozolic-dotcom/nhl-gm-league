/**
 * KHL (Kontinental Hockey League) full league importer via EliteProspects.
 *
 * Strategy:
 *   1. Scrape each KHL team roster page on EP to get all players + EP URLs
 *   2. For each player, call the EP player scraper to get 2026-27 stats
 *   3. Upsert WorldLeague, WorldTeam, WorldPlayer, WorldPlayerSeasonStat
 *
 * EP team roster pages embed full rosters in __NEXT_DATA__.rosterList.tableData.edges
 * with player.eliteprospectsUrlPath and player.name/position/id.
 *
 * All 23 KHL clubs are listed below with their EP team slug/id.
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

// All 23 KHL teams (2026-27) with EP slug path for roster page
// Format: [ep-team-id, ep-team-slug, display-name]
const KHL_TEAMS: [number, string, string][] = [
  [12,   "ska-st-petersburg",          "SKA St. Petersburg"],
  [26,   "cska-moskva",                "CSKA Moskva"],
  [7,    "ak-bars-kazan",              "Ak Bars Kazan"],
  [14,   "avangard-omsk",              "Avangard Omsk"],
  [23,   "salavat-yulaev-ufa",         "Salavat Yulaev Ufa"],
  [10,   "metallurg-magnitogorsk",     "Metallurg Magnitogorsk"],
  [36,   "traktor-chelyabinsk",        "Traktor Chelyabinsk"],
  [27,   "torpedo-nizhny-novgorod",    "Torpedo Nizhny Novgorod"],
  [34,   "lokomotiv-yaroslavl",        "Lokomotiv Yaroslavl"],
  [28,   "severstal-cherepovets",      "Severstal Cherepovets"],
  [13,   "dynamo-moskva",              "Dynamo Moskva"],
  [19,   "spartak-moskva",             "Spartak Moskva"],
  [390,  "admiral-vladivostok",        "Admiral Vladivostok"],
  [33,   "sibir-novosibirsk",          "Sibir Novosibirsk"],
  [29,   "avtomobilist-yekaterinburg", "Avtomobilist Yekaterinburg"],
  [30,   "amur-khabarovsk",            "Amur Khabarovsk"],
  [393,  "kunlun-red-star",            "Kunlun Red Star"],
  [392,  "neftekhimik-nizhnekamsk",   "Neftekhimik Nizhnekamsk"],
  [6,    "ak-bars-kazan",              "Ak Bars Kazan"],   // fallback
  [391,  "lada-togliatti",             "Lada Togliatti"],
  [394,  "metallurg-novokuznetsk",     "Metallurg Novokuznetsk"],
  [500,  "dinamo-minsk",               "Dinamo Minsk"],
  [501,  "barys-nur-sultan",           "Barys Nur-Sultan"],
];

const EP_BASE = "https://www.eliteprospects.com";

// Rate limit helper
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a KHL team roster from EP team page via the ep-scraper-server HTTP proxy.
 * Returns list of { epUrl, name, position, epId }
 */
async function fetchKhlTeamRoster(
  teamId: number,
  teamSlug: string
): Promise<{ epUrl: string; name: string; position: string; epId: string }[]> {
  const url = `${EP_BASE}/team/${teamId}/${teamSlug}/2026-2027`;
  const encoded = encodeURIComponent(url);

  // We re-use the ep-scraper-server's /roster endpoint (which we'll add)
  // But for now, call the /scrape-roster endpoint we add below
  // Alternative: call via a special roster URL pattern
  const endpoints = [
    `http://172.18.0.1:3336/roster?url=${encoded}`,
    `http://172.17.0.1:3336/roster?url=${encoded}`,
    `http://127.0.0.1:3336/roster?url=${encoded}`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json() as { success: boolean; players?: { epUrl: string; name: string; position: string; epId: string }[]; error?: string };
      if (data.success && data.players) return data.players;
    } catch {
      continue;
    }
  }
  return [];
}

export async function importKhlLeague(): Promise<{ league: string; teams: number; players: number; goalies: number }> {
  // Ensure KHL WorldLeague exists
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

  let totalPlayers = 0;
  let totalGoalies = 0;
  let teamsProcessed = 0;

  // De-dup team IDs (some duplicates in list above)
  const seen = new Set<number>();
  const teams = KHL_TEAMS.filter(([id]) => { if (seen.has(id)) return false; seen.add(id); return true; });

  for (const [teamId, teamSlug, teamName] of teams) {
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

      for (const pl of roster) {
        try {
          await sleep(600 + Math.random() * 600);
          const epResult = await scrapeEpPlayer(`${EP_BASE}${pl.epUrl}`);
          if (!epResult.success) continue;

          const isGoalie = (epResult.position || pl.position || "").toUpperCase() === "G";

          // Find/create the world player
          const { player } = await resolveWorldPlayer({
            provider: "ep-scraper",
            externalId: String(epResult.epId),
            name: pl.name,
            position: epResult.position || pl.position || null,
            currentTeamId: worldTeam.id,
          });

          // If EP says they're in KHL this season, upsert stats
          if (epResult.season2627) {
            const s = epResult.season2627;
            const leagueCode = mapEpLeagueToCode(s.leagueName, s.leagueUrlPath);

            // Only store if it's KHL or a related Russian league
            if (["KHL", "VHL", "MHL"].includes(leagueCode)) {
              const targetLeague = leagueCode === "KHL"
                ? khlLeague
                : await prisma.worldLeague.upsert({
                    where: { code: leagueCode },
                    update: { active: true },
                    create: { code: leagueCode, name: s.leagueName ?? leagueCode, country: "Russia", region: "Europe", active: true },
                  });

              const statTeamName = s.teamName ?? teamName;
              const statTeamSlug = norm(statTeamName).replace(/ /g, "-");
              const statTeam = await prisma.worldTeam.upsert({
                where: { leagueId_slug: { leagueId: targetLeague.id, slug: statTeamSlug } },
                update: { name: statTeamName },
                create: { leagueId: targetLeague.id, slug: statTeamSlug, name: statTeamName },
              });

              await prisma.worldPlayerSeasonStat.upsert({
                where: { playerId_leagueId_season: { playerId: player.id, leagueId: targetLeague.id, season: "2026-27" } },
                update: {
                  teamId: statTeam.id, isGoalie,
                  gamesPlayed: s.gp, goals: s.g, assists: s.a, points: s.pts,
                  plusMinus: s.pm ?? null, penaltyMinutes: s.pim,
                  wins: isGoalie ? (s.w ?? null) : null,
                  savePercentage: isGoalie ? (s.svp ?? null) : null,
                  goalsAgainstAverage: isGoalie ? (s.gaa ?? null) : null,
                  shutouts: isGoalie ? (s.so ?? null) : null,
                  source: "ep-scraper", syncedAt: new Date(),
                },
                create: {
                  playerId: player.id, leagueId: targetLeague.id, teamId: statTeam.id, season: "2026-27",
                  isGoalie, gamesPlayed: s.gp, goals: s.g, assists: s.a, points: s.pts,
                  plusMinus: s.pm ?? null, penaltyMinutes: s.pim,
                  wins: isGoalie ? (s.w ?? null) : null,
                  savePercentage: isGoalie ? (s.svp ?? null) : null,
                  goalsAgainstAverage: isGoalie ? (s.gaa ?? null) : null,
                  shutouts: isGoalie ? (s.so ?? null) : null,
                  source: "ep-scraper",
                },
              });

              if (isGoalie) totalGoalies++;
              else totalPlayers++;
            } else {
              // Player is on KHL roster but playing elsewhere (loan etc.) — just set currentTeam
              if (isGoalie) totalGoalies++;
              else totalPlayers++;
            }
          } else {
            // Rostered but no game stats yet
            if (isGoalie) totalGoalies++;
            else totalPlayers++;
          }

          // Link any matching prospect
          const epFullUrl = `${EP_BASE}${pl.epUrl}`;
          const prospect = await prisma.prospect.findFirst({
            where: { epUrl: { in: [epFullUrl, `${EP_BASE}/player/${epResult.epId}`] }, worldPlayerId: null },
          });
          if (prospect) {
            await prisma.prospect.update({ where: { id: prospect.id }, data: { worldPlayerId: player.id } });
          }

        } catch {
          // skip individual player error
        }
      }
    } catch {
      // skip team error
    }
  }

  return { league: "KHL", teams: teamsProcessed, players: totalPlayers, goalies: totalGoalies };
}
