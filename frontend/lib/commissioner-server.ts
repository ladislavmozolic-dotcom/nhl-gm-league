// Commissioner dashboard data — one "Today" snapshot of everything a commissioner
// needs to look at before hitting Simulate Day: games ready, teams missing lines,
// illegal / short lineups, injuries forcing a roster move, and pending trades.
// The less manual work to run a day, the more likely a league migrates here.

import { prisma } from "./prisma";
import { getLeagueDate, computePhase } from "./calendar-server";
import { addDays, utcDay } from "./calendar";
import { leagueCapCompliance } from "./cap";
import { isWorthyGoalie } from "./goalie-rule";

const SEASON = "2026-27";
const MIN_F = 12, MIN_D = 6, MIN_G = 2;

export type TeamFlag = { teamId: number; code: string | null; name: string; slug: string | null; detail: string };
export type CommishToday = {
  leagueDate: string; nextDate: string; phase: string;
  gamesReady: number; matchups: { away: string; home: string }[];
  missingLines: TeamFlag[];
  shortLineups: TeamFlag[];   // below 12F/6D/2G healthy → needs a call-up
  capOffenders: TeamFlag[];
  noWorthyGoalie: TeamFlag[]; // no NHL-roster goalie meeting the worthy-goalie rule (see lib/goalie-rule.ts)
  pendingTrades: number;
  injuredActive: number;      // injured players still on NHL rosters
};

const isFwd = (pos: string) => /(^|\/)(C|LW|RW)(\/|$)/.test(pos.toUpperCase());
const isDef = (pos: string) => /(^|\/)D(\/|$)/.test(pos.toUpperCase());
const isG = (pos: string) => /(^|\/)G(\/|$)/.test(pos.toUpperCase());

export async function commishToday(): Promise<CommishToday> {
  const cur = await getLeagueDate();
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true } });
  const next = addDays(cur, 1);
  const phase = await computePhase(next, cfg?.phaseOverride);
  const start = utcDay(next), end = addDays(next, 1);

  const [dayGames, teams, lines, capOff, pendingTrades, nhlPlayers] = await Promise.all([
    prisma.game.findMany({ where: { season: SEASON, status: "SCHEDULED", gameDate: { gte: start, lt: end } }, select: { homeTeam: { select: { code: true, name: true } }, awayTeam: { select: { code: true, name: true } } } }),
    prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, code: true, name: true, slug: true } }),
    prisma.teamLines.findMany({ select: { teamId: true, forwardLines: true } }),
    leagueCapCompliance(phase === "regular" ? "regular" : undefined).catch(() => []),
    prisma.trade.count({ where: { status: "PENDING" } }),
    prisma.player.findMany({ where: { rosterType: "NHL", team: { league: "NHL" } }, select: { teamId: true, position: true, injuryDaysLeft: true, overall: true, isGoalie: true, lastSeasonGP: true, lastSeasonSvPct: true } }),
  ]);

  const linesByTeam = new Map(lines.map((l) => [l.teamId, Array.isArray(l.forwardLines) ? (l.forwardLines as unknown[]).length : 0]));
  const roster = new Map<number, { f: number; d: number; g: number; injured: number }>();
  for (const t of teams) roster.set(t.id, { f: 0, d: 0, g: 0, injured: 0 });
  const worthyGoalie = new Map<number, boolean>();
  for (const t of teams) worthyGoalie.set(t.id, false);
  let injuredActive = 0;
  for (const p of nhlPlayers) {
    const r = roster.get(p.teamId); if (!r) continue;
    if (p.isGoalie && isWorthyGoalie(p)) worthyGoalie.set(p.teamId, true);
    if (p.injuryDaysLeft > 0) { r.injured++; injuredActive++; continue; } // injured don't dress
    if (isG(p.position)) r.g++; else if (isDef(p.position)) r.d++; else if (isFwd(p.position)) r.f++;
  }

  const missingLines: TeamFlag[] = [], shortLineups: TeamFlag[] = [];
  for (const t of teams) {
    if (!linesByTeam.get(t.id)) missingLines.push({ teamId: t.id, code: t.code, name: t.name, slug: t.slug, detail: "no lines set" });
    const r = roster.get(t.id)!;
    const gaps: string[] = [];
    if (r.f < MIN_F) gaps.push(`${MIN_F - r.f} F`);
    if (r.d < MIN_D) gaps.push(`${MIN_D - r.d} D`);
    if (r.g < MIN_G) gaps.push(`${MIN_G - r.g} G`);
    if (gaps.length) shortLineups.push({ teamId: t.id, code: t.code, name: t.name, slug: t.slug, detail: `short ${gaps.join(", ")}${r.injured ? ` (${r.injured} injured)` : ""}` });
  }

  const capOffenders: TeamFlag[] = (capOff as { teamId: number; code: string | null; over: number }[])
    .filter((o) => o.over > 0)
    .map((o) => { const t = teams.find((x) => x.id === o.teamId); return { teamId: o.teamId, code: o.code, name: t?.name ?? o.code ?? "", slug: t?.slug ?? null, detail: `$${(o.over / 1_000_000).toFixed(2)}M over` }; });

  const noWorthyGoalie: TeamFlag[] = teams
    .filter((t) => !worthyGoalie.get(t.id))
    .map((t) => ({ teamId: t.id, code: t.code, name: t.name, slug: t.slug, detail: "no worthy goalie" }));

  return {
    leagueDate: cur.toISOString(), nextDate: next.toISOString(), phase,
    gamesReady: dayGames.length,
    matchups: dayGames.slice(0, 16).map((g) => ({ away: g.awayTeam.code ?? g.awayTeam.name, home: g.homeTeam.code ?? g.homeTeam.name })),
    missingLines, shortLineups, capOffenders, noWorthyGoalie, pendingTrades, injuredActive,
  };
}
