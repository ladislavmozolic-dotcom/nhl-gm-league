import { prisma } from "@/lib/prisma";
import { epSearchName } from "@/lib/playerName";
import { resolveWorldPlayer } from "@/lib/world-player-identity";

type Json = Record<string, unknown>;

type HockeyTechLeague = { code: "WHL" | "OHL" | "QMJHL" | "AHL"; name: string; country: string; clientCode: string; key: string; leagueId: string; baseUrl: string };
const LEAGUES: Record<HockeyTechLeague["code"], HockeyTechLeague> = {
  WHL: { code: "WHL", name: "Western Hockey League", country: "Canada / USA", clientCode: "whl", key: "f1aa699db3d81487", leagueId: "26", baseUrl: "https://lscluster.hockeytech.com/feed/index.php" },
  OHL: { code: "OHL", name: "Ontario Hockey League", country: "Canada", clientCode: "ohl", key: "f1aa699db3d81487", leagueId: "1", baseUrl: "https://lscluster.hockeytech.com/feed/index.php" },
  QMJHL: { code: "QMJHL", name: "Quebec Maritimes Junior Hockey League", country: "Canada", clientCode: "lhjmq", key: "f322673b6bcae299", leagueId: "1", baseUrl: "https://cluster.leaguestat.com/feed/index.php" },
  AHL: { code: "AHL", name: "American Hockey League", country: "USA / Canada", clientCode: "ahl", key: "ccb91f29d6744675", leagueId: "4", baseUrl: "https://lscluster.hockeytech.com/feed/index.php" },
};

const normalize = (name: string) => epSearchName(name).replace(/\s*\([^)]*\)/g, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const integer = (value: unknown) => Number.parseInt(String(value ?? "0"), 10) || 0;

/** HockeyTech serves the same JSON data used by CHL's public stats sites, wrapped
 * in parentheses (JSONP). This parser accepts both the wrapped and plain forms. */
async function hockeyTech(url: URL): Promise<Json> {
  const response = await fetch(url, { headers: { "User-Agent": "UNHL Around-the-World/1.0 (+https://unhl.eu)" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HockeyTech returned ${response.status}.`);
  const text = (await response.text()).trim().replace(/^\(/, "").replace(/\)$/, "");
  return JSON.parse(text) as Json;
}

function url(config: HockeyTechLeague, params: Record<string, string>) {
  const u = new URL(config.baseUrl);
  for (const [key, value] of Object.entries({ ...params, key: config.key, client_code: config.clientCode, fmt: "json" })) u.searchParams.set(key, value);
  return u;
}

function seasonLabel(row: Json) {
  const start = String(row.start_date ?? "");
  const end = String(row.end_date ?? "");
  const first = start.slice(0, 4); const last = end.slice(2, 4);
  if (/^\d{4}$/.test(first) && /^\d{2}$/.test(last)) {
    return first.slice(2) === last ? `${first}-${String(Number(first) + 1).slice(2)}` : `${first}-${last}`;
  }
  return String(row.shortname ?? "Current");
}

async function importSeason(code: HockeyTechLeague["code"]) {
  const config = LEAGUES[code];
  const seasons = await hockeyTech(url(config, { feed: "modulekit", view: "seasons" }));
  const rows = ((seasons.SiteKit as Json | undefined)?.Seasons ?? []) as Json[];
  const now = new Date().toISOString().slice(0, 10);
  const regularRows = rows.filter((s) => s.playoff === "0");
  // Strictly target the current 2026-27 regular season across all leagues
  const season =
    regularRows.find((s) => String(s.start_date).startsWith("2026") && s.career === "1") ??
    regularRows.find((s) => String(s.start_date) <= now && String(s.end_date) >= now) ??
    regularRows.find((s) => s.career === "1") ??
    regularRows[0];
  if (!season?.season_id) throw new Error(`${code} did not return an active regular season.`);
  const seasonId = String(season.season_id);
  const seasonName = "2026-27";

  const fetchStats = async (sid: string) => {
    return Promise.all([
      hockeyTech(url(config, { feed: "modulekit", view: "teamsbyseason", season_id: sid })),
      hockeyTech(url(config, { feed: "statviewfeed", view: "players", season: sid, team: "all", position: "skaters", rookies: "0", statsType: "standard", rosterstatus: "undefined", site_id: "0", league_id: config.leagueId, lang: "en", division: "-1", conference: "-1", limit: "1000", sort: "points" })),
      hockeyTech(url(config, { feed: "statviewfeed", view: "players", season: sid, team: "all", position: "goalies", rookies: "0", statsType: "standard", rosterstatus: "undefined", site_id: "0", league_id: config.leagueId, lang: "en", division: "-1", conference: "-1", limit: "1000", sort: "wins" })),
    ]);
  };

  const [teamsRaw, skatersRaw, goaliesRaw] = await fetchStats(seasonId);
  const sectionRows = (raw: Json) => (((raw as unknown as Json[])[0]?.sections as Json[] | undefined)?.[0]?.data ?? []) as Json[];
  const skaterSection = sectionRows(skatersRaw);

  const league = await prisma.worldLeague.upsert({
    where: { code },
    update: { name: config.name, country: config.country },
    create: { code, name: config.name, country: config.country, region: "North America" },
  });

  const teams = (((teamsRaw.SiteKit as Json | undefined)?.Teamsbyseason ?? []) as Json[]);
  const byExternalId = new Map<string, number>();
  const byCode = new Map<string, number>();
  const birthDates = new Map<string, string>();
  for (const team of teams) {
    const externalId = String(team.id); const tCode = String(team.code ?? externalId);
    const saved = await prisma.worldTeam.upsert({ where: { leagueId_externalId: { leagueId: league.id, externalId } }, update: { name: String(team.name), city: String(team.city ?? "") || null, slug: tCode.toLowerCase() }, create: { leagueId: league.id, externalId, name: String(team.name), city: String(team.city ?? "") || null, slug: tCode.toLowerCase() } });
    byExternalId.set(externalId, saved.id); byCode.set(tCode, saved.id);
  }

  // Sample DOBs from rosters
  const teamIds = teams.map((team) => String(team.id));
  for (let offset = 0; offset < teamIds.length; offset += 6) {
    await Promise.all(teamIds.slice(offset, offset + 6).map(async (teamId) => {
      try {
        const roster = await hockeyTech(url(config, { feed: "modulekit", view: "roster", season_id: seasonId, team_id: teamId }));
        for (const member of ((roster.SiteKit as Json | undefined)?.Roster ?? []) as Json[]) {
          const birthDate = String(member.rawbirthdate ?? member.birthdate ?? "");
          if (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) birthDates.set(String(member.player_id ?? member.id), birthDate);
        }
      } catch { /* roster DOB optional */ }
    }));
  }

  const goalieRows = sectionRows(goaliesRaw);
  const all = [...skaterSection.map((v) => ({ data: (v.row ?? {}) as Json, prop: (v.prop ?? {}) as Json, goalie: false })), ...goalieRows.map((v) => ({ data: (v.row ?? {}) as Json, prop: (v.prop ?? {}) as Json, goalie: true }))];
  const allProspects = await prisma.prospect.findMany({ select: { id: true, name: true, epUrl: true, worldPlayerId: true, source: true } });
  const prospectsByName = new Map<string, typeof allProspects>();
  for (const prospect of allProspects) {
    const key = normalize(prospect.name);
    prospectsByName.set(key, [...(prospectsByName.get(key) ?? []), prospect]);
  }

  let linked = 0;
  for (const { data, prop, goalie } of all) {
    const provider = code.toLowerCase(); const sourceId = String(data.player_id); const externalId = `${provider}:${sourceId}`;
    const name = String(data.name ?? (prop.shortname as Json | undefined)?.seoName ?? "").trim();
    if (!name) continue;
    const teamId = byExternalId.get(String(data.team_id ?? "")) ?? byCode.get(String(data.team_code ?? "")) ?? null;
    const birthDate = birthDates.get(String(data.player_id));
    const matching = prospectsByName.get(normalize(name)) ?? [];
    const player = matching.length > 0
      ? (await resolveWorldPlayer({ provider, externalId: sourceId, name, position: goalie ? "G" : String(data.position ?? "") || null, currentTeamId: teamId, birthDate })).player
      : await prisma.worldPlayer.upsert({ where: { externalId }, update: { name, normalizedName: normalize(name), position: goalie ? "G" : String(data.position ?? "") || null, currentTeamId: teamId, ...(birthDate ? { birthDate } : {}) }, create: { externalId, name, normalizedName: normalize(name), position: goalie ? "G" : String(data.position ?? "") || null, currentTeamId: teamId, birthDate } });

    await prisma.worldPlayerSeasonStat.upsert({
      where: { playerId_leagueId_season: { playerId: player.id, leagueId: league.id, season: seasonName } },
      update: { teamId, isGoalie: goalie, gamesPlayed: integer(data.games_played), goals: integer(data.goals), assists: integer(data.assists), points: integer(data.points), plusMinus: goalie ? null : integer(data.plus_minus), penaltyMinutes: integer(data.penalty_minutes), wins: goalie ? integer(data.wins) : null, losses: goalie ? integer(data.losses) : null, overtimeLosses: goalie ? integer(data.ot_losses ?? data.overtime_losses) : null, savePercentage: goalie && data.save_percentage != null ? Number(data.save_percentage) : null, goalsAgainstAverage: goalie && data.goals_against_average != null ? Number(data.goals_against_average) : null, shutouts: goalie ? integer(data.shutouts) : null, source: "official-feed", syncedAt: new Date() },
      create: { playerId: player.id, leagueId: league.id, teamId, season: seasonName, isGoalie: goalie, gamesPlayed: integer(data.games_played), goals: integer(data.goals), assists: integer(data.assists), points: integer(data.points), plusMinus: goalie ? null : integer(data.plus_minus), penaltyMinutes: integer(data.penalty_minutes), wins: goalie ? integer(data.wins) : null, losses: goalie ? integer(data.losses) : null, overtimeLosses: goalie ? integer(data.ot_losses ?? data.overtime_losses) : null, savePercentage: goalie && data.save_percentage != null ? Number(data.save_percentage) : null, goalsAgainstAverage: goalie && data.goals_against_average != null ? Number(data.goals_against_average) : null, shutouts: goalie ? integer(data.shutouts) : null, source: "official-feed" },
    });

    if (matching.length > 0) {
      for (const prospect of matching) {
        if (prospect.worldPlayerId !== player.id) await prisma.prospect.update({ where: { id: prospect.id }, data: { worldPlayerId: player.id } });
        if (prospect.epUrl && !player.epUrl) await prisma.worldPlayer.update({ where: { id: player.id }, data: { epUrl: prospect.epUrl } });
      }
      linked++;
    }
  }

  return { season: seasonName, teams: teams.length, players: all.length, goalies: goalieRows.length, linked };
}

export const importWhlSeason = () => importSeason("WHL");
export const importOhlSeason = () => importSeason("OHL");
export const importQmjhlSeason = () => importSeason("QMJHL");
export const importAhlSeason = () => importSeason("AHL");
