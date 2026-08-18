// Persistent roster auto-fill. When a club owns fewer than a legal 12 F / 6 D /
// 2 G, promote the best available farm players ONTO its roster (rosterType +
// teamId), so they show up, count against the salary cap, and STAY there until
// the GM sends them back down. This is the durable counterpart to loadSimTeam's
// in-game call-ups (which only cover temporary injury gaps).

import { prisma } from "./prisma";

const isDef = (p: string) => /(^|\/)D(\/|$)/.test(p) || p === "D";
const MIN_F = 12, MIN_D = 6, MIN_G = 2;

export type RosterFill = { team: string; f: number; d: number; g: number };

export async function autoFillRosters(league = "NHL"): Promise<RosterFill[]> {
  const teams = await prisma.team.findMany({ where: { league, isAffiliate: false }, select: { id: true, name: true } });
  const filled: RosterFill[] = [];

  for (const team of teams) {
    const affs = await prisma.team.findMany({ where: { parentTeamId: team.id }, select: { id: true } });
    const affIds = affs.map((a) => a.id);
    if (!affIds.length) continue; // no farm to draw from

    const roster = await prisma.player.findMany({
      where: { teamId: team.id, rosterType: league },
      select: { id: true, isGoalie: true, position: true },
    });
    const nF = roster.filter((p) => !p.isGoalie && !isDef(p.position ?? "")).length;
    const nD = roster.filter((p) => !p.isGoalie && isDef(p.position ?? "")).length;
    const nG = roster.filter((p) => p.isGoalie).length;
    const needF = Math.max(0, MIN_F - nF), needD = Math.max(0, MIN_D - nD), needG = Math.max(0, MIN_G - nG);
    if (!needF && !needD && !needG) continue;

    const pool = await prisma.player.findMany({
      where: { teamId: { in: affIds }, injuryDaysLeft: { lte: 0 } }, // only promote healthy bodies
      orderBy: { overall: "desc" },
      select: { id: true, isGoalie: true, position: true },
    });
    const takeF = pool.filter((p) => !p.isGoalie && !isDef(p.position ?? "")).slice(0, needF);
    const takeD = pool.filter((p) => !p.isGoalie && isDef(p.position ?? "")).slice(0, needD);
    const takeG = pool.filter((p) => p.isGoalie).slice(0, needG);
    const ids = [...takeF, ...takeD, ...takeG].map((p) => p.id);
    if (!ids.length) continue;

    // promote onto the NHL roster (rosterType + teamId) — durable, counts to cap
    await prisma.player.updateMany({ where: { id: { in: ids } }, data: { teamId: team.id, rosterType: league } });
    filled.push({ team: team.name, f: takeF.length, d: takeD.length, g: takeG.length });
  }
  return filled;
}

/** AHL farms can't draw from a lower league — when NHL call-ups leave them short of a
 *  legal lineup, activate their own healthy SCRATCHES (scratched → dressed) so their
 *  games actually simulate instead of being skipped. */
export async function fillAhlFromScratched(): Promise<RosterFill[]> {
  const teams = await prisma.team.findMany({ where: { league: "AHL" }, select: { id: true, name: true } });
  const filled: RosterFill[] = [];
  for (const team of teams) {
    // only HEALTHY dressed players count — an injured "active" can't play, so we must
    // still activate a healthy scratch to replace him (else the game skips to 0-0).
    const active = await prisma.player.findMany({
      where: { teamId: team.id, rosterType: "AHL", scratched: false, injuryDaysLeft: { lte: 0 } },
      select: { isGoalie: true, position: true },
    });
    const nF = active.filter((p) => !p.isGoalie && !isDef(p.position ?? "")).length;
    const nD = active.filter((p) => !p.isGoalie && isDef(p.position ?? "")).length;
    const nG = active.filter((p) => p.isGoalie).length;
    const needF = Math.max(0, MIN_F - nF), needD = Math.max(0, MIN_D - nD), needG = Math.max(0, MIN_G - nG);
    if (!needF && !needD && !needG) continue;

    const bench = await prisma.player.findMany({
      where: { teamId: team.id, rosterType: "AHL", scratched: true, injuryDaysLeft: { lte: 0 } }, // healthy scratches only
      orderBy: { overall: "desc" },
      select: { id: true, isGoalie: true, position: true },
    });
    const takeF = bench.filter((p) => !p.isGoalie && !isDef(p.position ?? "")).slice(0, needF);
    const takeD = bench.filter((p) => !p.isGoalie && isDef(p.position ?? "")).slice(0, needD);
    const takeG = bench.filter((p) => p.isGoalie).slice(0, needG);
    const ids = [...takeF, ...takeD, ...takeG].map((p) => p.id);
    if (!ids.length) continue;

    await prisma.player.updateMany({ where: { id: { in: ids } }, data: { scratched: false } });
    filled.push({ team: team.name, f: takeF.length, d: takeD.length, g: takeG.length });
  }
  return filled;
}
