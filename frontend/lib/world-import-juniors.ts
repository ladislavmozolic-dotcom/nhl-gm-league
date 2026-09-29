import { load } from "cheerio";
import { prisma } from "@/lib/prisma";
import { normalizeWorldName, resolveWorldPlayer } from "@/lib/world-player-identity";

type Json = Record<string, unknown>;

const integer = (value: unknown) => Number.parseInt(String(value ?? "0"), 10) || 0;
const decimal = (value: unknown) => {
  const parsed = Number(String(value ?? "0").replace(",", ".").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const currentSeasonLabel = () => {
  const now = new Date();
  const start = now.getUTCFullYear() - (now.getUTCMonth() < 7 ? 1 : 0);
  return `${start}-${String(start + 1).slice(2)}`;
};
const clean = (value: string) => value.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
const firstLast = (value: string) => {
  const [last, ...first] = clean(value).split(",");
  return first.length ? `${first.join(",").trim()} ${last.trim()}` : clean(value);
};
const slug = (value: string) => normalizeWorldName(value).replace(/ /g, "-");

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "UNHL Around-the-World/1.0 (+https://unhl.eu)" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}.`);
  return response.text();
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "UNHL Around-the-World/1.0 (+https://unhl.eu)", accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}.`);
  return response.json() as Promise<T>;
}

async function saveStat(input: {
  playerId: number; leagueId: number; teamId: number; season: string; goalie: boolean;
  gp: number; goals?: number; assists?: number; points?: number; plusMinus?: number | null; pim?: number;
  wins?: number | null; losses?: number | null; savePercentage?: number | null; gaa?: number | null; shutouts?: number | null;
}) {
  const data = {
    teamId: input.teamId, isGoalie: input.goalie, gamesPlayed: input.gp,
    goals: input.goals ?? 0, assists: input.assists ?? 0, points: input.points ?? 0,
    plusMinus: input.plusMinus ?? null, penaltyMinutes: input.pim ?? 0,
    wins: input.wins ?? null, losses: input.losses ?? null,
    savePercentage: input.savePercentage ?? null, goalsAgainstAverage: input.gaa ?? null,
    shutouts: input.shutouts ?? null, source: "official-feed", syncedAt: new Date(),
  };
  await prisma.worldPlayerSeasonStat.upsert({
    where: { playerId_leagueId_season: { playerId: input.playerId, leagueId: input.leagueId, season: input.season } },
    update: data,
    create: { playerId: input.playerId, leagueId: input.leagueId, season: input.season, ...data },
  });
}

type FinnishSeason = { current?: boolean; SeasonNumber?: number; SeasonName?: string };
type FinnishLevel = { LevelID?: number; LevelName?: string };
type FinnishDistrict = { DistrictID?: number };
type FinnishSubSerie = { subSerieId?: number; subSerieName?: string };
type FinnishTeam = { TeamID?: number; TeamName?: string | null; TeamAbbrv?: string | null; Img?: string | null };
type FinnishCompetition = { seasonNumber?: number; subSerieId?: number; teams?: FinnishTeam[] };

const leijonatUrl = (path: string, params: Record<string, string | number>) => {
  const url = new URL(path, "https://tulospalvelu.leijonat.fi");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
};

async function importFinnishJuniorLevel(levelName: "U20 SM-sarja" | "U18 SM-sarja", code: "FIN-U20" | "FIN-U18") {
  const seasons = await fetchJson<FinnishSeason[]>("https://tulospalvelu.leijonat.fi/helpers/getseasons");
  const seasonNumber = seasons.find((item) => item.current)?.SeasonNumber;
  if (!seasonNumber) throw new Error("Leijonat current season was not found.");
  const levels = await fetchJson<FinnishLevel[]>(leijonatUrl("/helpers/getlevels", { season: seasonNumber }));
  const level = levels.find((item) => item.LevelName === levelName);
  if (!level?.LevelID) throw new Error(`${levelName} was not found in Leijonat.`);
  const districts = await fetchJson<FinnishDistrict[]>(leijonatUrl("/helpers/getdistricts", { season: seasonNumber, levelId: level.LevelID }));
  const districtId = districts[0]?.DistrictID ?? 0;
  const subSeries = await fetchJson<FinnishSubSerie[]>(leijonatUrl("/serie/helpers/getsubseries", { season: seasonNumber, levelid: level.LevelID, districtid: districtId }));
  const subSerie = subSeries.find((item) => item.subSerieName?.toLowerCase().includes(levelName.toLowerCase().replace("-sarja", ""))) ?? subSeries[0];
  if (!subSerie?.subSerieId) throw new Error(`${levelName} sub-series was not found in Leijonat.`);

  const competition = await fetchJson<FinnishCompetition>(leijonatUrl("/serie/helpers/getsubserie", { season: seasonNumber, subSerieId: subSerie.subSerieId, teamid: 0 }));
  const common = { season: seasonNumber, type: 0, teamid: "", nop: 0, subSerieId: subSerie.subSerieId };
  const skaterParams = { ...common, "filters[Games]": "", "filters[Strength]": "", "filters[Rookies]": 0, "filters[Total]": 0, "filters[Period]": "", "filters[SortOrder]": "DESC", "filters[SortedBy]": "PlayerPoints" };
  const goalieParams = { ...common, gamesratio: 0, levelid: level.LevelID, "filters[Games]": "", "filters[Rookies]": 0, "filters[Total]": 0, "filters[Period]": "", "filters[SortOrder]": "DESC", "filters[SortedBy]": "GoalieSavesPerc", "filters[PlayerName]": "" };
  const [skaterResult, goalieResult, league] = await Promise.all([
    fetchJson<{ Players?: Json[] }>(leijonatUrl("/helpers/getplayers", skaterParams)),
    fetchJson<{ Players?: Json[] }>(leijonatUrl("/helpers/getgoalkeepers", goalieParams)),
    prisma.worldLeague.upsert({
      where: { code }, update: { active: true, name: `Finnish ${levelName}` },
      create: { code, name: `Finnish ${levelName}`, country: "Finland", region: "Europe" },
    }),
  ]);
  const age = code.endsWith("U20") ? "U20" : "U18";
  const teamRows = competition.teams ?? [];
  const teamById = new Map<number, FinnishTeam>(teamRows.flatMap((team) => team.TeamID ? [[team.TeamID, team]] : []));
  const savedTeams = new Map<number, number>();
  const ensureTeam = async (teamId: number, fallback: string) => {
    const source = teamById.get(teamId); const baseName = source?.TeamName || source?.TeamAbbrv || fallback || "Unknown";
    const name = `${baseName} ${age}`;
    const team = await prisma.worldTeam.upsert({
      where: { leagueId_externalId: { leagueId: league.id, externalId: String(teamId) } },
      update: { name }, create: { leagueId: league.id, externalId: String(teamId), slug: slug(name), name },
    });
    savedTeams.set(teamId, team.id); return team.id;
  };

  let imported = 0; let goalies = 0;
  for (const row of skaterResult.Players ?? []) {
    const playerId = integer(row.PlayerID); const teamId = integer(row.TeamID);
    const name = clean(`${row.FirstName ?? ""} ${row.LastName ?? ""}`);
    if (!playerId || !teamId || !name) continue;
    const worldTeamId = savedTeams.get(teamId) ?? await ensureTeam(teamId, String(row.TeamAbbrv ?? ""));
    const { player } = await resolveWorldPlayer({
      provider: "leijonat", externalId: String(playerId), name,
      position: String(row.RoleAbbrv ?? "F") || "F", birthDate: String(row.DateOfBirth ?? "") || null,
      nationality: "FIN", currentTeamId: worldTeamId,
    });
    await saveStat({ playerId: player.id, leagueId: league.id, teamId: worldTeamId, season: `${seasonNumber - 1}-${String(seasonNumber).slice(2)}`, goalie: false,
      gp: integer(row.PlayerGames), goals: integer(row.PlayerGoals), assists: integer(row.PlayerAssists), points: integer(row.PlayerPoints), plusMinus: integer(row.PlayerPlusMinus), pim: integer(row.PlayerPenaltyMin) });
    imported++;
  }
  for (const row of goalieResult.Players ?? []) {
    const playerId = integer(row.PlayerID); const teamId = integer(row.TeamID);
    const name = clean(`${row.FirstName ?? ""} ${row.LastName ?? ""}`);
    if (!playerId || !teamId || !name) continue;
    const worldTeamId = savedTeams.get(teamId) ?? await ensureTeam(teamId, String(row.TeamAbbrv ?? ""));
    const { player } = await resolveWorldPlayer({ provider: "leijonat", externalId: String(playerId), name, position: "G", nationality: "FIN", currentTeamId: worldTeamId });
    await saveStat({ playerId: player.id, leagueId: league.id, teamId: worldTeamId, season: `${seasonNumber - 1}-${String(seasonNumber).slice(2)}`, goalie: true,
      gp: integer(row.GoaliePlayedGames), wins: integer(row.GoalieWinGames), losses: integer(row.GoalieLossGames),
      savePercentage: decimal(row.GoalieSavesPerc), gaa: decimal(row.GoalieGA60Min), shutouts: integer(row.GoalieZeroGames) });
    imported++; goalies++;
  }
  return { league: code, season: `${seasonNumber - 1}-${String(seasonNumber).slice(2)}`, imported, goalies };
}

type SwedishRoster = { birthDate: string | null; position: string | null; nationality: string | null };

function selectedSwedishSeason(html: string) {
  const $ = load(html);
  const label = $("option[selected='selected']").map((_, item) => clean($(item).text())).get().find((value) => /^\d{4}-\d{2}$/.test(value));
  return label ?? null;
}

function swedishCompetitionIds(html: string, level: "U20" | "U18") {
  const $ = load(html); const ids = new Set<number>();
  $("a[href*='/ScheduleAndResults/']").each((_, item) => {
    const text = clean($(item).text()); const href = $(item).attr("href") ?? "";
    const wanted = level === "U20" ? /U20.*Nationell/i.test(text) : /U18.*(?:Nationell|Regional)|(?:Nationell|Regional).*U18/i.test(text);
    const id = Number(href.match(/\/(\d+)(?:\?.*)?$/)?.[1]);
    if (wanted && id) ids.add(id);
  });
  return [...ids];
}

function parseSwedishRosters(html: string) {
  const $ = load(html); const rosters = new Map<string, SwedishRoster>();
  $("table.tblContent").each((_, table) => {
    const headers = $(table).find("tr").first().next().find("th.tdHeader").map((__, cell) => clean($(cell).text())).get();
    if (!headers.includes("Birthdate")) return;
    $(table).find("tr").each((__, row) => {
      const cells = $(row).find("td").map((___, cell) => clean($(cell).text())).get();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[2] ?? "")) return;
      const name = firstLast(cells[1] ?? "");
      if (name) rosters.set(normalizeWorldName(name), { birthDate: cells[2], position: cells[3] || null, nationality: cells[7] || null });
    });
  });
  return rosters;
}

async function importSwedishCompetition(competitionId: number, level: "U20" | "U18", leagueId: number, season: string) {
  const [statsHtml, rosterHtml] = await Promise.all([
    fetchText(`https://stats.swehockey.se/Teams/Info/PlayersByTeam/${competitionId}`),
    fetchText(`https://stats.swehockey.se/Teams/Info/TeamRoster/${competitionId}`),
  ]);
  const $ = load(statsHtml); const rosters = parseSwedishRosters(rosterHtml);
  let imported = 0; let goalies = 0;
  for (const element of $(".TSMstats a[id]").toArray()) {
    const baseTeamName = clean($(element).attr("id") ?? "");
    if (!baseTeamName) continue;
    const playingWrapper = $(element).nextAll("table.tblBorderNoPad").first();
    const goalieWrapper = playingWrapper.nextAll("table.tblBorderNoPad").first();
    const tables = [playingWrapper.find("table.tblContent").first().get(0), goalieWrapper.find("table.tblContent").first().get(0)].filter((table): table is NonNullable<typeof table> => Boolean(table));
    if (!tables.length) continue;
    const name = `${baseTeamName} ${level}`; const externalId = `${level}:${slug(baseTeamName)}`;
    const team = await prisma.worldTeam.upsert({
      where: { leagueId_externalId: { leagueId, externalId } }, update: { name },
      create: { leagueId, externalId, slug: slug(name), name },
    });
    for (const [tableIndex, table] of tables.entries()) {
      const title = clean($(table).find("th.tdSubTitle").first().text());
      const goalie = /Goalkeeping/i.test(title);
      if (tableIndex > 0 && !goalie) continue;
      $(table).find("tr").each((_, row) => {
        // Processing is performed below after collecting rows; Cheerio callbacks cannot await.
        $(row).attr("data-unhl-row", goalie ? "goalie" : "skater");
      });
      const rows = $(table).find("tr[data-unhl-row]").toArray();
      for (const row of rows) {
        const cells = $(row).find("td").map((_, cell) => clean($(cell).text())).get();
        if (cells.length < (goalie ? 12 : 9)) continue;
        const playerName = firstLast(cells[2] ?? "");
        const roster = rosters.get(normalizeWorldName(playerName));
        const position = goalie ? "G" : (cells[3] || roster?.position || "F");
        if (!playerName || (!goalie && position === "GK")) continue;
        const identity = roster?.birthDate ? `${roster.birthDate}:${normalizeWorldName(playerName)}` : `${level}:${normalizeWorldName(playerName)}`;
        const { player } = await resolveWorldPlayer({ provider: "swehockey", externalId: identity, name: playerName, position, birthDate: roster?.birthDate, nationality: roster?.nationality, currentTeamId: team.id });
        if (goalie) {
          await saveStat({ playerId: player.id, leagueId, teamId: team.id, season, goalie: true, gp: integer(cells[5]), savePercentage: decimal(cells[10]), gaa: decimal(cells[11]) });
          goalies++;
        } else {
          await saveStat({ playerId: player.id, leagueId, teamId: team.id, season, goalie: false, gp: integer(cells[4]), goals: integer(cells[5]), assists: integer(cells[6]), points: integer(cells[7]), pim: integer(cells[8]), plusMinus: integer(cells[11]) });
        }
        imported++;
      }
    }
  }
  return { imported, goalies };
}

async function importSwedishJuniorLevel(level: "U20" | "U18", code: "SWE-U20" | "SWE-U18") {
  const home = await fetchText("https://stats.swehockey.se/");
  let candidates = swedishCompetitionIds(home, level);
  if (level === "U20" && candidates.length) {
    const groupPage = await fetchText(`https://stats.swehockey.se/Teams/Info/PlayersByTeam/${candidates[0]}`);
    candidates = [...new Set([...candidates, ...swedishCompetitionIds(groupPage, level)])];
  }
  const season = currentSeasonLabel(); const active: number[] = [];
  for (const id of candidates) {
    const page = await fetchText(`https://stats.swehockey.se/Teams/Info/PlayersByTeam/${id}`);
    if (selectedSwedishSeason(page) === season) active.push(id);
  }
  if (!active.length) throw new Error(`Current Swedish ${level} competitions were not found.`);
  const league = await prisma.worldLeague.upsert({
    where: { code }, update: { active: true, name: `Swedish ${level} Nationell` },
    create: { code, name: `Swedish ${level} Nationell`, country: "Sweden", region: "Europe" },
  });
  let imported = 0; let goalies = 0;
  for (const id of active) {
    const result = await importSwedishCompetition(id, level, league.id, season);
    imported += result.imported; goalies += result.goalies;
  }
  return { league: code, season, competitions: active.length, imported, goalies };
}

async function fetchSlovakPages(path: string) {
  const first = await fetchText(`https://www.hockeyslovakia.sk${path}${path.includes("?") ? "&" : "?"}page=1`);
  const $ = load(first);
  const lastPage = Math.max(1, ...$("[data-pager-page]").map((_, item) => integer($(item).attr("data-pager-page"))).get());
  const rest = await Promise.all(Array.from({ length: lastPage - 1 }, (_, index) => fetchText(`https://www.hockeyslovakia.sk${path}${path.includes("?") ? "&" : "?"}page=${index + 2}`)));
  return [first, ...rest];
}

async function importSlovakJuniorLevel(tournamentId: 1197 | 1201 | 1202, level: "Senior" | "U20" | "U18", code: "SVK" | "SVK-U20" | "SVK-U18") {
  const competitionSlug = tournamentId === 1197 ? "extraliga" : tournamentId === 1201 ? "extraliga-juniorov" : "kaufland-extraliga-dorastu";
  const leagueTitle = tournamentId === 1197 ? "Tipos Extraliga" : tournamentId === 1201 ? "Slovak U20 Extraliga" : "Slovak U18 Extraliga";
  const [skaterPages, goaliePages, league] = await Promise.all([
    fetchSlovakPages(`/sk/stats/players/${tournamentId}/${competitionSlug}?StatsType=points`),
    fetchSlovakPages(`/sk/stats/goalies/${tournamentId}/${competitionSlug}?StatsType=svs`),
    prisma.worldLeague.upsert({
      where: { code }, update: { active: true, name: leagueTitle },
      create: { code, name: leagueTitle, country: "Slovakia", region: "Europe" },
    }),
  ]);
  const teams = new Map<string, number>();
  const ensureTeam = async (teamCode: string, baseName: string) => {
    const key = teamCode || slug(baseName); const cached = teams.get(key); if (cached) return cached;
    const name = level === "Senior" ? (baseName || teamCode) : `${baseName || teamCode} ${level}`;
    const team = await prisma.worldTeam.upsert({
      where: { leagueId_externalId: { leagueId: league.id, externalId: key } }, update: { name },
      create: { leagueId: league.id, externalId: key, slug: `${slug(name)}-${slug(key)}`, name },
    });
    teams.set(key, team.id); return team.id;
  };
  let imported = 0; let goalies = 0;
  for (const html of skaterPages) {
    const $ = load(html);
    for (const row of $("table tbody tr").toArray()) {
      const nameCell = $(row).find(".column-FullName"); const href = nameCell.find("a").attr("href") ?? "";
      const externalId = href.match(/\/player\/(\d+)/)?.[1]; const name = firstLast(nameCell.text());
      const teamCell = $(row).find(".column-TeamCode"); const teamCode = clean(teamCell.text()); const teamName = clean(teamCell.find("abbr").attr("title") ?? teamCode);
      if (!externalId || !name || !teamCode) continue;
      const teamId = await ensureTeam(teamCode, teamName);
      const position = clean($(row).find(".column-PlayerPosition").text()) || "F";
      const { player } = await resolveWorldPlayer({ provider: "hockeyslovakia", externalId, name, position, nationality: "SVK", currentTeamId: teamId });
      await saveStat({ playerId: player.id, leagueId: league.id, teamId, season: currentSeasonLabel(), goalie: false,
        gp: integer($(row).find(".column-GamesPlayed").text()), goals: integer($(row).find(".column-Goals").text()),
        assists: integer($(row).find(".column-Assists").text()), points: integer($(row).find(".column-Points").text()),
        plusMinus: integer($(row).find(".column-PlusMinusPoints").text()), pim: integer($(row).find(".column-PenaltiesInMinutes").text()) });
      imported++;
    }
  }
  for (const html of goaliePages) {
    const $ = load(html);
    for (const row of $("table tbody tr").toArray()) {
      const nameCell = $(row).find(".column-FullName"); const href = nameCell.find("a").attr("href") ?? "";
      const externalId = href.match(/\/player\/(\d+)/)?.[1]; const name = firstLast(nameCell.text());
      const teamCell = $(row).find(".column-TeamCode"); const teamCode = clean(teamCell.text()); const teamName = clean(teamCell.find("abbr").attr("title") ?? teamCode);
      if (!externalId || !name || !teamCode) continue;
      const teamId = await ensureTeam(teamCode, teamName);
      const { player } = await resolveWorldPlayer({ provider: "hockeyslovakia", externalId, name, position: "G", nationality: "SVK", currentTeamId: teamId });
      await saveStat({ playerId: player.id, leagueId: league.id, teamId, season: currentSeasonLabel(), goalie: true,
        gp: integer($(row).find(".column-GoalieGamesPlayed").text()), wins: integer($(row).find(".column-Wins").text()),
        losses: integer($(row).find(".column-Losses").text()), savePercentage: decimal($(row).find(".column-SavesPercentage").text()),
        gaa: decimal($(row).find(".column-GoalsAgainstAverage").text()), shutouts: integer($(row).find(".column-Shutouts").text()) });
      imported++; goalies++;
    }
  }
  return { league: code, season: currentSeasonLabel(), imported, goalies, teams: teams.size };
}

export const importSlovakExtraliga = () => importSlovakJuniorLevel(1197, "Senior", "SVK");
export const importFinnishU20 = () => importFinnishJuniorLevel("U20 SM-sarja", "FIN-U20");
export const importFinnishU18 = () => importFinnishJuniorLevel("U18 SM-sarja", "FIN-U18");
export const importSwedishU20 = () => importSwedishJuniorLevel("U20", "SWE-U20");
export const importSwedishU18 = () => importSwedishJuniorLevel("U18", "SWE-U18");
export const importSlovakU20 = () => importSlovakJuniorLevel(1201, "U20", "SVK-U20");
export const importSlovakU18 = () => importSlovakJuniorLevel(1202, "U18", "SVK-U18");

export async function importEuropeanJuniorLeagues() {
  const importers = [importSlovakExtraliga, importFinnishU20, importFinnishU18, importSwedishU20, importSwedishU18, importSlovakU20, importSlovakU18];
  return Promise.all(importers.map(async (importer) => {
    try {
      return await importer();
    } catch (error) {
      console.error("[Around the World] Junior import failed:", error);
      return { error: error instanceof Error ? error.message : "Unknown import error" };
    }
  }));
}
