// Season Dashboard — a GM command center shown full-screen on login / a game day.
// Answers "what do I need to handle today?": the next game + readiness (lines /
// roster / cap), things needing attention (morale, fatigue, chemistry, expiring
// contracts), team form, and the latest storylines. All from league data.

import { prisma } from "./prisma";
import { getLeagueClock } from "./calendar-server";
import { teamCapStatus } from "./cap";
import { leagueForm } from "./digest-server";
import { teamLineBuilder } from "./line-builder-server";
import { goalieAnalytics } from "./goalie-analytics-server";
import { cleanName } from "./playerName";
import { money } from "./finance";

const SEASON = "2026-27";
const isFwd = (p: string) => /(^|\/)(C|LW|RW)(\/|$)/.test(p.toUpperCase());
const isDef = (p: string) => /(^|\/)D(\/|$)/.test(p.toUpperCase());
const isG = (p: string) => /(^|\/)G(\/|$)/.test(p.toUpperCase());

export type Attn = { icon: string; tone: string; text: string; href?: string };
export type GmDashboard = {
  team: { name: string; slug: string; code: string | null };
  nextGame: { opp: string; oppSlug: string | null; when: string; home: boolean; gameId: number } | null;
  ready: { lines: boolean; roster: boolean; rosterNote: string; capSpace: number; capOk: boolean };
  attention: Attn[];
  form: { last10: string; streakType: "W" | "L" | "OT" | null; streakLen: number; points: number; gp: number } | null;
  latest: string[];
};

export async function gmDashboard(teamId: number): Promise<GmDashboard | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true, slug: true, code: true, league: true } });
  if (!team) return null;
  const league = team.league ?? "NHL";
  const clock = await getLeagueClock();
  const now = clock.date;

  // NEXT GAME
  const ng = await prisma.game.findFirst({
    where: { season: SEASON, league, status: "SCHEDULED", seriesId: null, gameDate: { gte: new Date(now.getTime() - 86400000) }, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: [{ gameDate: "asc" }], select: { id: true, gameDate: true, homeTeamId: true, homeTeam: { select: { code: true, name: true, slug: true } }, awayTeam: { select: { code: true, name: true, slug: true } } },
  });
  let nextGame: GmDashboard["nextGame"] = null;
  if (ng) {
    const home = ng.homeTeamId === teamId;
    const opp = home ? ng.awayTeam : ng.homeTeam;
    const days = ng.gameDate ? Math.round((new Date(ng.gameDate).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000) : null;
    const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : ng.gameDate ? new Date(ng.gameDate).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) : "TBD";
    nextGame = { opp: opp.code ?? opp.name, oppSlug: opp.slug, when, home, gameId: ng.id };
  }

  // READINESS: lines / roster / cap
  const [linesRow, roster, cap] = await Promise.all([
    prisma.teamLines.findUnique({ where: { teamId }, select: { forwardLines: true } }),
    prisma.player.findMany({ where: { teamId, rosterType: league === "AHL" ? "AHL" : "NHL" }, select: { name: true, slug: true, position: true, injuryDaysLeft: true, morale: true, condition: true, contractYears: true, isGoalie: true, overall: true } }),
    teamCapStatus(teamId).catch(() => null),
  ]);
  const linesOk = Array.isArray(linesRow?.forwardLines) && (linesRow!.forwardLines as unknown[]).length > 0;
  let f = 0, d = 0, g = 0;
  for (const p of roster) { if (p.injuryDaysLeft > 0) continue; if (isG(p.position)) g++; else if (isDef(p.position)) d++; else if (isFwd(p.position)) f++; }
  const gaps: string[] = [];
  if (f < 12) gaps.push(`${12 - f} F`); if (d < 6) gaps.push(`${6 - d} D`); if (g < 2) gaps.push(`${2 - g} G`);
  const rosterOk = gaps.length === 0;
  const capSpace = cap?.space ?? 0;
  const capOk = cap ? cap.compliant : true;

  // ATTENTION
  const attention: Attn[] = [];
  const teamHref = `/teams/${team.slug}`;
  if (!linesOk) attention.push({ icon: "📋", tone: "text-amber-400", text: "Lines not submitted — set your lineup", href: `${teamHref}/lines` });
  if (!rosterOk) attention.push({ icon: "⛔", tone: "text-rose-400", text: `Illegal lineup — short ${gaps.join(", ")}`, href: `${teamHref}/roster` });
  if (cap && cap.overBy > 0) attention.push({ icon: "💰", tone: "text-rose-400", text: `Over the cap by ${money(cap.overBy)}`, href: `${teamHref}/salary` });
  // low morale
  for (const p of roster.filter((p) => !p.isGoalie && (p.morale ?? 75) < 62 && (p.overall ?? 0) >= 55).sort((a, b) => (a.morale ?? 75) - (b.morale ?? 75)).slice(0, 3))
    attention.push({ icon: "⚠", tone: "text-amber-400", text: `${cleanName(p.name)} — low morale (${Math.round(p.morale ?? 0)})`, href: p.slug ? `/players/${p.slug}` : undefined });
  // skater fatigue (CON worn down)
  for (const p of roster.filter((p) => !p.isGoalie && (p.condition ?? 100) < 92).sort((a, b) => (a.condition ?? 100) - (b.condition ?? 100)).slice(0, 2))
    attention.push({ icon: "🔋", tone: "text-amber-400", text: `${cleanName(p.name)} — fatigue elevated (CON ${Math.round(p.condition ?? 0)})`, href: p.slug ? `/players/${p.slug}` : undefined });
  // starter goalie fatigue
  const starter = roster.filter((p) => p.isGoalie).sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))[0];
  if (starter) {
    const sp = await prisma.player.findFirst({ where: { teamId, name: starter.name }, select: { id: true } });
    if (sp) { const ga = await goalieAnalytics(sp.id); if (ga && (ga.fatigue.level === "Elevated" || ga.fatigue.level === "High")) attention.push({ icon: "🧤", tone: ga.fatigue.level === "High" ? "text-rose-400" : "text-amber-400", text: `${cleanName(starter.name)} — fatigue ${ga.fatigue.level.toLowerCase()} (${ga.fatigue.recentStarts}/${ga.fatigue.recentWindow} starts)`, href: starter.slug ? `/players/${starter.slug}` : undefined }); }
  }
  // low line chemistry
  const build = await teamLineBuilder(teamId, league).catch(() => null);
  if (build) for (const l of build.forwards.filter((l) => l.gelled && l.chemistry < 62).slice(0, 2))
    attention.push({ icon: "🧪", tone: "text-amber-400", text: `Line ${l.index + 1} chemistry dropped to ${l.chemistry}`, href: `${teamHref}/lines/builder` });
  // expiring contracts (final year)
  for (const p of roster.filter((p) => p.contractYears === 1 && (p.overall ?? 0) >= 60).slice(0, 2))
    attention.push({ icon: "📄", tone: "text-sky-400", text: `${cleanName(p.name)} — contract expires end of season`, href: p.slug ? `/players/${p.slug}` : undefined });

  // FORM
  const forms = await leagueForm(SEASON, (await prisma.game.findFirst({ where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null }, orderBy: { round: "desc" }, select: { round: true } }))?.round ?? 0, league);
  const mine = forms.find((x) => x.teamId === teamId);
  const form = mine ? { last10: mine.last10, streakType: mine.streakType, streakLen: mine.streakLen, points: mine.points, gp: mine.gp } : null;

  // LATEST — a couple of team storylines
  const latest: string[] = [];
  const gameIds = (await prisma.game.findMany({ where: { season: SEASON, league, status: "FINAL", seriesId: null, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] }, orderBy: { round: "desc" }, take: 10, select: { id: true } })).map((x) => x.id);
  if (gameIds.length) {
    const topSk = await prisma.playerGameStat.groupBy({ by: ["playerId"], where: { teamId, gameId: { in: gameIds } }, _sum: { points: true, goals: true }, orderBy: { _sum: { points: "desc" } }, take: 1 });
    if (topSk[0]?._sum.points) { const nm = (await prisma.player.findUnique({ where: { id: topSk[0].playerId }, select: { name: true } }))?.name; latest.push(`🔥 ${cleanName(nm ?? "")} — ${topSk[0]._sum.points} pts in the last ${gameIds.length}`); }
  }
  if (starter) { const sp = await prisma.player.findFirst({ where: { teamId, name: starter.name }, select: { id: true } }); if (sp) { const ga = await goalieAnalytics(sp.id); if (ga) latest.push(`🧤 ${cleanName(starter.name)} — ${ga.last10.gsax >= 0 ? "+" : ""}${ga.last10.gsax} GSAx over his last ${ga.last10.gp}`); } }
  if (form) latest.push(form.streakType === "W" && form.streakLen >= 3 ? `📈 ${form.streakLen}-game win streak` : form.streakType === "L" && form.streakLen >= 3 ? `📉 winless in ${form.streakLen}` : `record ${mine!.last10} in the last 10`);

  return {
    team: { name: team.name, slug: team.slug, code: team.code },
    nextGame,
    ready: { lines: linesOk, roster: rosterOk, rosterNote: rosterOk ? "Legal" : `Short ${gaps.join(", ")}`, capSpace, capOk },
    attention, form, latest,
  };
}
