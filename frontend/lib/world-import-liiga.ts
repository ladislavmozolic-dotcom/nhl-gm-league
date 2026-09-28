import { prisma } from "@/lib/prisma";
import { epSearchName } from "@/lib/playerName";

const norm = (value: string) => epSearchName(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const number = (value: unknown) => Number.parseInt(String(value ?? 0), 10) || 0;

/** Targeted Liiga sync: fetches the official public season table but persists
 * only exact, unambiguous UNHL prospect matches. */
export async function importLiigaProspects() {
  const now = new Date();
  const season = now.getUTCFullYear() + (now.getUTCMonth() >= 7 ? 1 : 0); // Liiga uses the season END year: Sep 2026 → 2027
  const [response, goalieResponse] = await Promise.all(["basicStats", "basicStatsGk"].map((dataType) => fetch(`https://www.liiga.fi/api/v2/players/stats/summed/${season}/${season}/runkosarja/false?team=&dataType=${dataType}&splitTeams=true`, { headers: { "User-Agent": "UNHL Around-the-World/1.0 (+https://unhl.eu)" }, cache: "no-store", signal: AbortSignal.timeout(20_000) })));
  if (!response.ok || !goalieResponse.ok) throw new Error(`Liiga returned skaters ${response.status}, goalies ${goalieResponse.status}.`);
  const [rows, goalieRows] = await Promise.all([response.json(), goalieResponse.json()]) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>];
  const standingsResponse = await fetch(`https://www.liiga.fi/api/v2/standings/?season=${season}`, { headers: { "User-Agent": "UNHL Around-the-World/1.0 (+https://unhl.eu)" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const standings = standingsResponse.ok ? await standingsResponse.json() as { season?: Array<{ teamName?: string; teamLogos?: { darkBg?: string } }> } : {};
  const teamLogos = new Map((standings.season ?? []).map((t) => [t.teamName, t.teamLogos?.darkBg]));
  const prospects = await prisma.prospect.findMany({ select: { id: true, name: true, epUrl: true, worldPlayerId: true, worldPlayer: { select: { externalId: true } } } });
  const wanted = new Map<string, typeof prospects>();
  for (const p of prospects) wanted.set(norm(p.name), [...(wanted.get(norm(p.name)) ?? []), p]);
  const league = await prisma.worldLeague.upsert({ where: { code: "LIIGA" }, update: {}, create: { code: "LIIGA", name: "Liiga", country: "Finland", region: "Europe" } });
  let imported = 0;
  let goalies = 0;
  for (const row of [...rows, ...goalieRows]) {
    const isGoalie = row.goalkeeper === true;
    const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(); const matches = wanted.get(norm(name)) ?? [];
    if (matches.length !== 1 || !row.playerId) continue;
    const p = matches[0];
    const externalId = `liiga:${row.playerId}`;
    if (p.worldPlayerId && p.worldPlayer?.externalId !== externalId) continue;
    const teamName = String(row.teamName ?? "Unknown"); const teamSlug = String(row.teamShortName ?? teamName).toLowerCase();
    const logoUrl = teamLogos.get(teamName) ?? null;
    const team = await prisma.worldTeam.upsert({ where: { leagueId_slug: { leagueId: league.id, slug: teamSlug } }, update: { name: teamName, logoUrl }, create: { leagueId: league.id, slug: teamSlug, name: teamName, logoUrl } });
    const player = await prisma.worldPlayer.upsert({ where: { externalId }, update: { name, normalizedName: norm(name), position: isGoalie ? "G" : String(row.role ?? "") || null, nationality: String(row.nationality ?? "") || null, currentTeamId: team.id, epUrl: p.epUrl }, create: { externalId, name, normalizedName: norm(name), position: isGoalie ? "G" : String(row.role ?? "") || null, nationality: String(row.nationality ?? "") || null, currentTeamId: team.id, epUrl: p.epUrl } });
    await prisma.worldPlayerSeasonStat.upsert({ where: { playerId_leagueId_season: { playerId: player.id, leagueId: league.id, season: `${season - 1}-${String(season).slice(2)}` } }, update: { teamId: team.id, isGoalie, gamesPlayed: number(isGoalie ? row.playedGames ?? row.games : row.games), goals: number(row.goals), assists: number(row.assists), points: number(row.points), plusMinus: isGoalie ? null : number(row.plusMinus), penaltyMinutes: number(row.penaltyMinutes), wins: isGoalie ? number(row.gkWins) : null, losses: isGoalie ? number(row.gkLosses) : null, savePercentage: isGoalie && row.savePercentage != null ? Number(row.savePercentage) : null, goalsAgainstAverage: isGoalie && row.goalsAgainstAvg != null ? Number(row.goalsAgainstAvg) : null, shutouts: isGoalie ? number(row.shutOut) : null, source: "official-feed", syncedAt: new Date() }, create: { playerId: player.id, leagueId: league.id, teamId: team.id, season: `${season - 1}-${String(season).slice(2)}`, isGoalie, gamesPlayed: number(isGoalie ? row.playedGames ?? row.games : row.games), goals: number(row.goals), assists: number(row.assists), points: number(row.points), plusMinus: isGoalie ? null : number(row.plusMinus), penaltyMinutes: number(row.penaltyMinutes), wins: isGoalie ? number(row.gkWins) : null, losses: isGoalie ? number(row.gkLosses) : null, savePercentage: isGoalie && row.savePercentage != null ? Number(row.savePercentage) : null, goalsAgainstAverage: isGoalie && row.goalsAgainstAvg != null ? Number(row.goalsAgainstAvg) : null, shutouts: isGoalie ? number(row.shutOut) : null, source: "official-feed" } });
    if (!p.worldPlayerId) await prisma.prospect.update({ where: { id: p.id }, data: { worldPlayerId: player.id } });
    imported++;
    if (isGoalie) goalies++;
  }
  return { season: `${season - 1}-${String(season).slice(2)}`, imported, goalies };
}
