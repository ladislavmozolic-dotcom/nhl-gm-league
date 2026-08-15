// Rivalry score — a 0-100 intensity for every pairing, grown from what actually
// happened between the two clubs: playoff meetings, a close head-to-head record,
// fights & injuries in their games, trades, plus structural (same division) and
// the GMs' own declared rivalries. Batched: one team's whole rivalry picture is
// computed from a handful of queries, then scored per opponent in memory.

import { prisma } from "./prisma";

export type RivalryFactor = { label: string; points: number };
export type Rivalry = {
  teamId: number; code: string | null; name: string; slug: string | null; logoUrl: string | null;
  score: number; factors: RivalryFactor[];
  gp: number; wins: number; losses: number; playoffSeries: number; fights: number; injuries: number; trades: number;
  sameDivision: boolean; declared: boolean;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export async function teamRivalries(teamId: number, league = "NHL"): Promise<Rivalry[]> {
  const me = await prisma.team.findUnique({ where: { id: teamId }, select: { division: true, conference: true, rivalTeamIds: true } });
  if (!me) return [];
  const others = await prisma.team.findMany({ where: { league, id: { not: teamId } }, select: { id: true, code: true, name: true, slug: true, logoUrl: true, division: true, conference: true, rivalTeamIds: true } });

  // all my games (reg + playoff), with the opponent + result + gameId
  const games = await prisma.game.findMany({
    where: { league, status: "FINAL", OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    select: { id: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, seriesId: true },
  });
  const gidToOpp = new Map<number, number>();
  const perOpp = new Map<number, { gp: number; w: number; l: number }>();
  const bump = (opp: number) => { let x = perOpp.get(opp); if (!x) { x = { gp: 0, w: 0, l: 0 }; perOpp.set(opp, x); } return x; };
  for (const g of games) {
    const opp = g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId;
    gidToOpp.set(g.id, opp);
    const x = bump(opp); x.gp++;
    const myGoals = g.homeTeamId === teamId ? (g.homeGoals ?? 0) : (g.awayGoals ?? 0);
    const oppGoals = g.homeTeamId === teamId ? (g.awayGoals ?? 0) : (g.homeGoals ?? 0);
    if (myGoals > oppGoals) x.w++; else x.l++;
  }

  const gids = [...gidToOpp.keys()];
  // fights (major penalties) + injuries in my games, mapped to the opponent
  const fightsByOpp = new Map<number, number>(), injByOpp = new Map<number, number>();
  if (gids.length) {
    const majors = await prisma.gameEvent.findMany({ where: { gameId: { in: gids }, type: "PENALTY" }, select: { gameId: true, meta: true } });
    for (const e of majors) { if ((e.meta as { severity?: string })?.severity === "Major") { const opp = gidToOpp.get(e.gameId); if (opp != null) fightsByOpp.set(opp, (fightsByOpp.get(opp) ?? 0) + 1); } }
    const injs = await prisma.gameEvent.groupBy({ by: ["gameId"], where: { gameId: { in: gids }, type: "INJURY" }, _count: { _all: true } });
    for (const r of injs) { const opp = gidToOpp.get(r.gameId); if (opp != null) injByOpp.set(opp, (injByOpp.get(opp) ?? 0) + r._count._all); }
  }

  // playoff series vs each opponent (round-weighted)
  const series = await prisma.playoffSeries.findMany({ where: { league, OR: [{ highSeedTeamId: teamId }, { lowSeedTeamId: teamId }] }, select: { highSeedTeamId: true, lowSeedTeamId: true, round: true } });
  const seriesByOpp = new Map<number, { count: number; roundBonus: number }>();
  for (const s of series) {
    const opp = s.highSeedTeamId === teamId ? s.lowSeedTeamId : s.highSeedTeamId;
    const cur = seriesByOpp.get(opp) ?? { count: 0, roundBonus: 0 };
    cur.count++; cur.roundBonus += s.round >= 4 ? 14 : s.round === 3 ? 6 : s.round === 2 ? 3 : 0;
    seriesByOpp.set(opp, cur);
  }

  // trades with each opponent
  const trades = await prisma.trade.findMany({ where: { OR: [{ fromTeamId: teamId }, { toTeamId: teamId }] }, select: { fromTeamId: true, toTeamId: true } });
  const tradesByOpp = new Map<number, number>();
  for (const t of trades) { const opp = t.fromTeamId === teamId ? t.toTeamId : t.fromTeamId; tradesByOpp.set(opp, (tradesByOpp.get(opp) ?? 0) + 1); }

  const out: Rivalry[] = [];
  for (const o of others) {
    const rec = perOpp.get(o.id) ?? { gp: 0, w: 0, l: 0 };
    const ser = seriesByOpp.get(o.id) ?? { count: 0, roundBonus: 0 };
    const fights = fightsByOpp.get(o.id) ?? 0;
    const injuries = injByOpp.get(o.id) ?? 0;
    const tr = tradesByOpp.get(o.id) ?? 0;
    const sameDiv = !!me.division && me.division === o.division;
    const sameConf = !!me.conference && me.conference === o.conference;
    const declared = me.rivalTeamIds.includes(o.id) || o.rivalTeamIds.includes(teamId);

    const factors: RivalryFactor[] = [];
    const add = (label: string, points: number) => { if (points > 0) factors.push({ label, points: Math.round(points) }); };
    add(sameDiv ? "Same division" : sameConf ? "Same conference" : "", sameDiv ? 22 : sameConf ? 10 : 0);
    if (declared) add("Declared rivalry", (me.rivalTeamIds.includes(o.id) ? 8 : 0) + (o.rivalTeamIds.includes(teamId) ? 8 : 0));
    add("Playoff meetings", ser.count * 14 + ser.roundBonus);
    add("Head-to-head history", Math.min(10, rec.gp * 0.6));
    if (rec.gp >= 4 && Math.abs(rec.w / rec.gp - 0.5) < 0.2) add("Evenly matched", 8);
    add("Fights", Math.min(15, fights * 1.5));
    add("Injuries in their games", Math.min(12, injuries * 0.6));
    add("Trades", Math.min(12, tr * 4));

    const score = clamp(factors.reduce((t, f) => t + f.points, 0));
    if (score <= 0 && !declared && rec.gp === 0) continue;
    out.push({
      teamId: o.id, code: o.code, name: o.name, slug: o.slug, logoUrl: o.logoUrl,
      score, factors: factors.sort((a, b) => b.points - a.points),
      gp: rec.gp, wins: rec.w, losses: rec.l, playoffSeries: ser.count, fights, injuries, trades: tr,
      sameDivision: sameDiv, declared,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}
