import { prisma } from "@/lib/prisma";
import { epSearchName } from "@/lib/playerName";

type Json = Record<string, unknown>;

type HockeyTechLeague = { code: "WHL" | "OHL" | "QMJHL"; name: string; country: string; clientCode: string; key: string; leagueId: string; baseUrl: string };
const LEAGUES: Record<HockeyTechLeague["code"], HockeyTechLeague> = {
  WHL: { code: "WHL", name: "Western Hockey League", country: "Canada / USA", clientCode: "whl", key: "f1aa699db3d81487", leagueId: "26", baseUrl: "https://lscluster.hockeytech.com/feed/index.php" },
  OHL: { code: "OHL", name: "Ontario Hockey League", country: "Canada", clientCode: "ohl", key: "f1aa699db3d81487", leagueId: "1", baseUrl: "https://lscluster.hockeytech.com/feed/index.php" },
  QMJHL: { code: "QMJHL", name: "Quebec Maritimes Junior Hockey League", country: "Canada", clientCode: "lhjmq", key: "f322673b6bcae299", leagueId: "1", baseUrl: "https://cluster.leaguestat.com/feed/index.php" },
};

const normalize = (name: string) => epSearchName(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
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
  return /^\d{4}$/.test(first) && /^\d{2}$/.test(last) ? `${first}-${last}` : String(row.shortname ?? "Current");
}

async function importSeason(code: HockeyTechLeague["code"]) {
  const config = LEAGUES[code];
  const seasons = await hockeyTech(url(config, { feed: "modulekit", view: "seasons" }));
  const rows = ((seasons.SiteKit as Json | undefined)?.Seasons ?? []) as Json[];
  const now = new Date().toISOString().slice(0, 10);
  const season = rows.find((s) => s.playoff === "0" && String(s.start_date) <= now && String(s.end_date) >= now) ?? rows.find((s) => s.playoff === "0" && s.career === "1");
  if (!season?.season_id) throw new Error(`${code} did not return an active regular season.`);
  const seasonId = String(season.season_id); const seasonName = seasonLabel(season);
  const [teamsRaw, skatersRaw, goaliesRaw, league] = await Promise.all([
    hockeyTech(url(config, { feed: "modulekit", view: "teamsbyseason", season_id: seasonId })),
    hockeyTech(url(config, { feed: "statviewfeed", view: "players", season: seasonId, team: "all", position: "skaters", rookies: "0", statsType: "standard", rosterstatus: "undefined", site_id: "0", league_id: config.leagueId, lang: "en", division: "-1", conference: "-1", limit: "1000", sort: "points" })),
    hockeyTech(url(config, { feed: "statviewfeed", view: "players", season: seasonId, team: "all", position: "goalies", rookies: "0", statsType: "standard", rosterstatus: "undefined", site_id: "0", league_id: config.leagueId, lang: "en", division: "-1", conference: "-1", limit: "1000", sort: "wins" })),
    prisma.worldLeague.upsert({ where: { code }, update: {}, create: { code, name: config.name, country: config.country, region: "North America" } }),
  ]);
  const teams = (((teamsRaw.SiteKit as Json | undefined)?.Teamsbyseason ?? []) as Json[]);
  const byExternalId = new Map<string, number>();
  const byCode = new Map<string, number>();
  const birthDates = new Map<string, string>();
  for (const team of teams) {
    const externalId = String(team.id); const code = String(team.code ?? externalId);
    const saved = await prisma.worldTeam.upsert({ where: { leagueId_externalId: { leagueId: league.id, externalId } }, update: { name: String(team.name), city: String(team.city ?? "") || null, slug: code.toLowerCase() }, create: { leagueId: league.id, externalId, name: String(team.name), city: String(team.city ?? "") || null, slug: code.toLowerCase() } });
    byExternalId.set(externalId, saved.id); byCode.set(code, saved.id);
  }
  // The standings feed has no DOB; official team rosters do. Keep this compact
  // (one request per club) and match on HockeyTech's stable player ID.
  const teamIds = teams.map((team) => String(team.id));
  for (let offset = 0; offset < teamIds.length; offset += 6) {
    await Promise.all(teamIds.slice(offset, offset + 6).map(async (teamId) => {
      try {
        const roster = await hockeyTech(url(config, { feed: "modulekit", view: "roster", season_id: seasonId, team_id: teamId }));
        for (const member of ((roster.SiteKit as Json | undefined)?.Roster ?? []) as Json[]) {
          const birthDate = String(member.rawbirthdate ?? member.birthdate ?? "");
          if (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) birthDates.set(String(member.player_id ?? member.id), birthDate);
        }
      } catch (error) { console.warn(`${code} roster ${teamId}: DOB unavailable`, error); }
    }));
  }
  const sectionRows = (raw: Json) => (((raw as unknown as Json[])[0]?.sections as Json[] | undefined)?.[0]?.data ?? []) as Json[];
  const goalieRows = sectionRows(goaliesRaw);
  const all = [...sectionRows(skatersRaw).map((v) => ({ data: (v.row ?? {}) as Json, prop: (v.prop ?? {}) as Json, goalie: false })), ...goalieRows.map((v) => ({ data: (v.row ?? {}) as Json, prop: (v.prop ?? {}) as Json, goalie: true }))];
  const unmatched = await prisma.prospect.findMany({ where: { worldPlayerId: null }, select: { id: true, name: true, epUrl: true } });
  const prospectsByName = new Map<string, typeof unmatched>();
  for (const prospect of unmatched) { const key = normalize(prospect.name); prospectsByName.set(key, [...(prospectsByName.get(key) ?? []), prospect]); }
  let linked = 0;
  for (const { data, prop, goalie } of all) {
    const externalId = `${code.toLowerCase()}:${String(data.player_id)}`;
    // HockeyTech goalie rows use "shortname" (initial + surname); the full
    // name is in prop.shortname.seoName. Skaters instead use row.name.
    const name = String(data.name ?? (prop.shortname as Json | undefined)?.seoName ?? "").trim();
    if (!name) continue;
    const teamId = byExternalId.get(String(data.team_id ?? "")) ?? byCode.get(String(data.team_code ?? "")) ?? null;
    const birthDate = birthDates.get(String(data.player_id));
    const player = await prisma.worldPlayer.upsert({ where: { externalId }, update: { name, normalizedName: normalize(name), position: goalie ? "G" : String(data.position ?? "") || null, currentTeamId: teamId, ...(birthDate ? { birthDate } : {}) }, create: { externalId, name, normalizedName: normalize(name), position: goalie ? "G" : String(data.position ?? "") || null, currentTeamId: teamId, birthDate } });
    await prisma.worldPlayerSeasonStat.upsert({ where: { playerId_leagueId_season: { playerId: player.id, leagueId: league.id, season: seasonName } }, update: { teamId, isGoalie: goalie, gamesPlayed: integer(data.games_played), goals: integer(data.goals), assists: integer(data.assists), points: integer(data.points), plusMinus: goalie ? null : integer(data.plus_minus), penaltyMinutes: integer(data.penalty_minutes), wins: goalie ? integer(data.wins) : null, losses: goalie ? integer(data.losses) : null, overtimeLosses: goalie ? integer(data.ot_losses ?? data.overtime_losses) : null, savePercentage: goalie && data.save_percentage != null ? Number(data.save_percentage) : null, goalsAgainstAverage: goalie && data.goals_against_average != null ? Number(data.goals_against_average) : null, shutouts: goalie ? integer(data.shutouts) : null, source: "official-feed", syncedAt: new Date() }, create: { playerId: player.id, leagueId: league.id, teamId, season: seasonName, isGoalie: goalie, gamesPlayed: integer(data.games_played), goals: integer(data.goals), assists: integer(data.assists), points: integer(data.points), plusMinus: goalie ? null : integer(data.plus_minus), penaltyMinutes: integer(data.penalty_minutes), wins: goalie ? integer(data.wins) : null, losses: goalie ? integer(data.losses) : null, overtimeLosses: goalie ? integer(data.ot_losses ?? data.overtime_losses) : null, savePercentage: goalie && data.save_percentage != null ? Number(data.save_percentage) : null, goalsAgainstAverage: goalie && data.goals_against_average != null ? Number(data.goals_against_average) : null, shutouts: goalie ? integer(data.shutouts) : null, source: "official-feed" } });
    const matching = prospectsByName.get(normalize(name)) ?? [];
    if (matching.length === 1) {
      const prospect = matching[0];
      await prisma.prospect.update({ where: { id: prospect.id }, data: { worldPlayerId: player.id } });
      // Existing UNHL prospect imports already carry a verified EP URL. Preserve
      // that exact profile when it exists instead of generating a name search.
      if (prospect.epUrl) await prisma.worldPlayer.update({ where: { id: player.id }, data: { epUrl: prospect.epUrl } });
      linked++;
    }
  }
  // Backfill direct EP profiles for links made by a previous import run too.
  const linkedProfiles = await prisma.prospect.findMany({ where: { worldPlayerId: { not: null }, epUrl: { not: null } }, select: { worldPlayerId: true, epUrl: true } });
  await Promise.all(linkedProfiles.map((p) => prisma.worldPlayer.update({ where: { id: p.worldPlayerId! }, data: { epUrl: p.epUrl } })));
  return { season: seasonName, teams: teams.length, players: all.length, goalies: goalieRows.length, linked };
}

export const importWhlSeason = () => importSeason("WHL");
export const importOhlSeason = () => importSeason("OHL");
export const importQmjhlSeason = () => importSeason("QMJHL");
