// Playoff race / magic numbers for the Standings page. NHL format: top 3 per
// division + 2 wild cards = 8 per conference. Clinch/elimination use pairwise
// point ceilings (floor = current points, ceiling = points + 2·games remaining):
//   • A finishes ABOVE B for sure  ⇔  floor(A) ≥ ceiling(B)
//   • A is CLINCHED a berth        ⇔  ≤7 conference rivals can still pass A
//   • A is ELIMINATED              ⇔  ≥8 rivals are already guaranteed above A
// The "magic number" is the classic one against the first team out (9th):
//   M = ceiling(9th) − points(A) + 1  (points A must gain / 9th must drop).

import { prisma } from "./prisma";
import { computeStandings } from "./sim/standings";

export type RaceTeam = {
  teamId: number; name: string; code: string | null; logoUrl: string | null; slug: string | null;
  division: string | null; rank: number; gp: number; remaining: number;
  points: number; maxPoints: number; diff: number;
  inPicture: boolean; divisionLeader: boolean; wildcard: boolean;
  clinchedBerth: boolean; clinchedDivision: boolean; presidents: boolean; eliminated: boolean;
  magic: number | null;        // to clinch a berth (vs 9th); null if clinched/eliminated/no bubble
  pointsFromLine: number;      // + = cushion above the cut line, − = points back of it
};

export type RaceConference = { name: string; color: string; teams: RaceTeam[]; cutLinePoints: number | null };

export async function playoffRace(season = "2026-27", league = "NHL"): Promise<RaceConference[]> {
  const [standings, teams, games] = await Promise.all([
    computeStandings(season, league),
    prisma.team.findMany({ select: { id: true, logoUrl: true, slug: true } }),
    prisma.game.findMany({ where: { season, league, seriesId: null }, select: { homeTeamId: true, awayTeamId: true } }),
  ]);
  const meta = new Map(teams.map((t) => [t.id, t]));
  const totalGP = new Map<number, number>(); // scheduled games (any status) per team
  for (const g of games) {
    totalGP.set(g.homeTeamId, (totalGP.get(g.homeTeamId) ?? 0) + 1);
    totalGP.set(g.awayTeamId, (totalGP.get(g.awayTeamId) ?? 0) + 1);
  }

  const confNames = [...new Set(standings.map((s) => s.conference).filter(Boolean))] as string[];
  if (confNames.length === 0) return [];

  const colorFor = (c: string) => (/east/i.test(c) ? "text-blue-400" : /west/i.test(c) ? "text-red-400" : "text-slate-400");
  const bestOverall = Math.max(...standings.map((s) => s.points), 0);

  const out: RaceConference[] = [];
  for (const conf of confNames) {
    const ct = standings.filter((s) => s.conference === conf); // already sorted best→worst
    const remOf = (id: number) => Math.max(0, (totalGP.get(id) ?? ct.find((x) => x.teamId === id)?.gp ?? 0) - (ct.find((x) => x.teamId === id)?.gp ?? 0));
    const ceil = new Map(ct.map((t) => [t.teamId, t.points + 2 * remOf(t.teamId)]));

    // playoff picture: top 3 per division + 2 wild cards
    const divisions = [...new Set(ct.map((t) => t.division))] as (string | null)[];
    const inSet = new Set<number>();
    const divLeaders = new Set<number>();
    const wildcards = new Set<number>();
    if (divisions.length === 2) {
      const auto: number[] = [];
      for (const d of divisions) {
        const dTeams = ct.filter((t) => t.division === d);
        if (dTeams[0]) divLeaders.add(dTeams[0].teamId);
        dTeams.slice(0, 3).forEach((t) => { auto.push(t.teamId); inSet.add(t.teamId); });
      }
      ct.filter((t) => !inSet.has(t.teamId)).slice(0, 2).forEach((t) => { wildcards.add(t.teamId); inSet.add(t.teamId); });
    } else {
      ct.slice(0, 8).forEach((t) => inSet.add(t.teamId));
    }

    const inTeams = ct.filter((t) => inSet.has(t.teamId));
    const outTeams = ct.filter((t) => !inSet.has(t.teamId));
    const cutLinePoints = inTeams.length ? Math.min(...inTeams.map((t) => t.points)) : null;
    const firstOut = outTeams[0] ?? null; // 9th (best team currently out)
    const firstOutCeil = firstOut ? (ceil.get(firstOut.teamId) ?? 0) : null;

    const raceTeams: RaceTeam[] = ct.map((t, i) => {
      const myCeil = ceil.get(t.teamId) ?? t.points;
      // rivals that can still pass me (their ceiling beats my floor)
      const canPass = ct.filter((o) => o.teamId !== t.teamId && (ceil.get(o.teamId) ?? 0) > t.points).length;
      // rivals already guaranteed above me (their floor beats my ceiling)
      const lockedAbove = ct.filter((o) => o.teamId !== t.teamId && o.points > myCeil).length;
      const clinchedBerth = canPass <= 7;
      const eliminated = lockedAbove >= 8;
      // division title: guaranteed 1st in own division (no division rival can reach my points)
      const divRivals = ct.filter((o) => o.teamId !== t.teamId && o.division === t.division);
      const clinchedDivision = divRivals.length > 0 && divRivals.every((o) => (ceil.get(o.teamId) ?? 0) < t.points);
      // Presidents' Trophy: best record in the whole league, mathematically locked
      const presidents = t.points === bestOverall && t.points > 0 &&
        standings.every((o) => o.teamId === t.teamId || (o.points + 2 * remOf(o.teamId)) < t.points);
      const magic = clinchedBerth || eliminated || firstOutCeil == null ? null : Math.max(0, firstOutCeil - t.points + 1);
      return {
        teamId: t.teamId, name: t.name, code: t.code, logoUrl: meta.get(t.teamId)?.logoUrl ?? null, slug: meta.get(t.teamId)?.slug ?? null,
        division: t.division, rank: i + 1, gp: t.gp, remaining: remOf(t.teamId),
        points: t.points, maxPoints: myCeil, diff: t.diff,
        inPicture: inSet.has(t.teamId), divisionLeader: divLeaders.has(t.teamId), wildcard: wildcards.has(t.teamId),
        clinchedBerth, clinchedDivision, presidents, eliminated,
        magic, pointsFromLine: cutLinePoints == null ? 0 : t.points - cutLinePoints,
      };
    });

    out.push({ name: conf, color: colorFor(conf), teams: raceTeams, cutLinePoints });
  }
  return out;
}
