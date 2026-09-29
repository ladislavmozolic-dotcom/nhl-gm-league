import { load } from "cheerio";
import { prisma } from "@/lib/prisma";
import { resolveWorldPlayer, normalizeWorldName } from "@/lib/world-player-identity";

type Json = Record<string, unknown>;
const integer = (value: unknown) => Number.parseInt(String(value ?? "0"), 10) || 0;
const seasonLabel = (year: number) => `${year}-${String(year + 1).slice(2)}`;
const isUnder24 = (birthDate: string | null | undefined) => {
  if (!birthDate) return false;
  const birth = new Date(`${birthDate}T00:00:00Z`); const now = new Date();
  const turns24 = new Date(Date.UTC(birth.getUTCFullYear() + 24, birth.getUTCMonth(), birth.getUTCDate()));
  return !Number.isNaN(birth.getTime()) && now < turns24;
};

async function json(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "UNHL Around-the-World/1.0 (+https://unhl.eu)" }, cache: "no-store", signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}.`);
  return response.json();
}

export async function importShlProspects() {
  const layout = await json("https://www.shl.se/api/statistics-v2/layout-info") as Array<{ originalSeasonSeriesGameTypeTeams?: Array<Json> }>;
  const entries = layout.flatMap((group) => group.originalSeasonSeriesGameTypeTeams ?? []);
  const active = entries.find((item) => item.state === "active" && (item.series as Json | undefined)?.code === "SHL" && (item.gameType as Json | undefined)?.code === "regular");
  if (!active?.ssgtUuid) throw new Error("SHL active regular season was not found.");
  const year = integer((active.season as Json | undefined)?.code) || new Date().getUTCFullYear();
  const [skaterData, goalieData, league, prospects] = await Promise.all([
    json(`https://www.shl.se/api/statistics-v2/stats-info/players_summary?ssgtUuid=${active.ssgtUuid}&count=1000`) as Promise<Array<Json>>,
    json(`https://www.shl.se/api/statistics-v2/stats-info/goalkeepers_summary?ssgtUuid=${active.ssgtUuid}&count=1000`) as Promise<Array<Json>>,
    prisma.worldLeague.upsert({ where: { code: "SHL" }, update: { active: true }, create: { code: "SHL", name: "Swedish Hockey League", country: "Sweden", region: "Europe" } }),
    prisma.prospect.findMany({ select: { name: true } }),
  ]);
  const owned = new Set(prospects.map((p) => normalizeWorldName(p.name)));
  const skaters = (skaterData[0]?.stats ?? []) as Json[]; const goalies = (goalieData[0]?.stats ?? []) as Json[];
  let imported = 0; let goalieCount = 0;
  for (const row of [...skaters.map((r) => ({ row: r, goalie: false })), ...goalies.map((r) => ({ row: r, goalie: true }))]) {
    const info = row.row.info as Json | undefined; const teamInfo = info?.team as Json | undefined;
    const name = String(info?.fullName ?? "").trim(); const birthDate = String(info?.birthDate ?? "") || null;
    if (!name || !info?.uuid || !teamInfo?.uuid || (!owned.has(normalizeWorldName(name)) && !isUnder24(birthDate))) continue;
    const teamName = String(teamInfo.siteDisplayName ?? teamInfo.name ?? "Unknown");
    const team = await prisma.worldTeam.upsert({ where: { leagueId_externalId: { leagueId: league.id, externalId: String(teamInfo.uuid) } }, update: { name: teamName, logoUrl: String(teamInfo.media ?? "") || null }, create: { leagueId: league.id, externalId: String(teamInfo.uuid), slug: String(teamInfo.code ?? teamInfo.uuid).toLowerCase(), name: teamName, logoUrl: String(teamInfo.media ?? "") || null } });
    const { player } = await resolveWorldPlayer({ provider: "shl", externalId: String(info.uuid), name, position: row.goalie ? "G" : String(info.position ?? "F"), birthDate, nationality: String(info.nationality ?? "") || null, currentTeamId: team.id });
    await prisma.worldPlayerSeasonStat.upsert({ where: { playerId_leagueId_season: { playerId: player.id, leagueId: league.id, season: seasonLabel(year) } }, update: {
      teamId: team.id, isGoalie: row.goalie, gamesPlayed: integer(row.goalie ? row.row.GPI : row.row.GP), goals: integer(row.row.G), assists: integer(row.row.A), points: integer(row.row.TP), plusMinus: row.goalie ? null : integer(row.row.PlusMinus), penaltyMinutes: integer(row.row.PIM), wins: row.goalie ? integer(row.row.W) : null, losses: row.goalie ? integer(row.row.L) : null, savePercentage: row.goalie ? Number(row.row.SVSPerc ?? 0) : null, goalsAgainstAverage: row.goalie ? Number(row.row.GAA ?? 0) : null, shutouts: row.goalie ? integer(row.row.SO) : null, source: "official-feed", syncedAt: new Date(),
    }, create: { playerId: player.id, leagueId: league.id, teamId: team.id, season: seasonLabel(year), isGoalie: row.goalie, gamesPlayed: integer(row.goalie ? row.row.GPI : row.row.GP), goals: integer(row.row.G), assists: integer(row.row.A), points: integer(row.row.TP), plusMinus: row.goalie ? null : integer(row.row.PlusMinus), penaltyMinutes: integer(row.row.PIM), wins: row.goalie ? integer(row.row.W) : null, losses: row.goalie ? integer(row.row.L) : null, savePercentage: row.goalie ? Number(row.row.SVSPerc ?? 0) : null, goalsAgainstAverage: row.goalie ? Number(row.row.GAA ?? 0) : null, shutouts: row.goalie ? integer(row.row.SO) : null, source: "official-feed" } });
    imported++; if (row.goalie) goalieCount++;
  }
  return { league: "SHL", season: seasonLabel(year), imported, goalies: goalieCount };
}

export async function importCzechExtraligaProspects() {
  const year = new Date().getUTCFullYear();
  const base = `https://www.hokej.cz/tipsport-extraliga/stats-center?competition=7562&season=${year}&stats-all=1`;
  const [skaterResponse, goalieResponse, league, prospects] = await Promise.all([
    fetch(`${base}&stats-order=p`, { cache: "no-store", signal: AbortSignal.timeout(25_000) }),
    fetch(`${base}&stats-section=goalkeeper`, { cache: "no-store", signal: AbortSignal.timeout(25_000) }),
    prisma.worldLeague.upsert({ where: { code: "CZE" }, update: { active: true }, create: { code: "CZE", name: "Czech Extraliga", country: "Czechia", region: "Europe" } }),
    prisma.prospect.findMany({ select: { name: true } }),
  ]);
  if (!skaterResponse.ok || !goalieResponse.ok) throw new Error(`Hokej.cz returned ${skaterResponse.status}/${goalieResponse.status}.`);
  const owned = new Set(prospects.map((p) => normalizeWorldName(p.name)));
  const parse = (html: string, goalie: boolean) => {
    const $ = load(html); const table = $("table").filter((_, t) => $(t).find("thead").text().includes("JMÉNO") && $(t).find("thead").text().includes(goalie ? "Sv%" : "TOI/GP")).last();
    return table.find("tbody tr").map((_, element) => { const cells = $(element).find("td").map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim()).get(); const href = $(element).find("a[href*='/hrac/']").attr("href") ?? ""; return { cells, href }; }).get();
  };
  const rows = [...parse(await skaterResponse.text(), false).map((r) => ({ ...r, goalie: false })), ...parse(await goalieResponse.text(), true).map((r) => ({ ...r, goalie: true }))];
  let imported = 0; let goalies = 0;
  for (const { cells, href, goalie } of rows) {
    const name = cells[1]; if (!name || !owned.has(normalizeWorldName(name))) continue;
    const playerId = href.match(/\/(\d+)(?:\?.*)?$/)?.[1]; if (!playerId) continue;
    const teamName = cells[2] || "Unknown"; const teamSlug = normalizeWorldName(teamName).replace(/ /g, "-");
    const team = await prisma.worldTeam.upsert({ where: { leagueId_slug: { leagueId: league.id, slug: teamSlug } }, update: { name: teamName }, create: { leagueId: league.id, slug: teamSlug, name: teamName } });
    const { player } = await resolveWorldPlayer({ provider: "hokej.cz", externalId: playerId, name, position: goalie ? "G" : (cells[3] === "O" ? "D" : "F"), currentTeamId: team.id });
    const stat = goalie ? { gp: integer(cells[4]), g: 0, a: integer(cells[14]), p: integer(cells[14]), pm: null, pim: integer(cells[15]), w: integer(cells[9]), l: integer(cells[10]), gaa: Number(cells[11]?.replace(",", ".") ?? 0), sv: Number(cells[12]?.replace(",", ".").replace("%", "") ?? 0), so: integer(cells[16]) } : { gp: integer(cells[4]), g: integer(cells[6]), a: integer(cells[7]), p: integer(cells[8]), pm: integer(cells[15]), pim: integer(cells[16]), w: null, l: null, gaa: null, sv: null, so: null };
    await prisma.worldPlayerSeasonStat.upsert({ where: { playerId_leagueId_season: { playerId: player.id, leagueId: league.id, season: seasonLabel(year) } }, update: { teamId: team.id, isGoalie: goalie, gamesPlayed: stat.gp, goals: stat.g, assists: stat.a, points: stat.p, plusMinus: stat.pm, penaltyMinutes: stat.pim, wins: stat.w, losses: stat.l, savePercentage: stat.sv, goalsAgainstAverage: stat.gaa, shutouts: stat.so, source: "official-feed", syncedAt: new Date() }, create: { playerId: player.id, leagueId: league.id, teamId: team.id, season: seasonLabel(year), isGoalie: goalie, gamesPlayed: stat.gp, goals: stat.g, assists: stat.a, points: stat.p, plusMinus: stat.pm, penaltyMinutes: stat.pim, wins: stat.w, losses: stat.l, savePercentage: stat.sv, goalsAgainstAverage: stat.gaa, shutouts: stat.so, source: "official-feed" } });
    imported++; if (goalie) goalies++;
  }
  return { league: "CZE", season: seasonLabel(year), imported, goalies };
}
