// Bridge between the DB (Prisma) and the pure simulation engine.

import { prisma } from "../prisma";
import { buildSkater, buildGoalie, buildTeam } from "./ratings";
import { simulateGame } from "./engine";
import { loadTeamLines, autoLines, deployDistinct } from "./lines";
import type { SimTeam, SkaterAttrs, GoalieAttrs } from "./types";

export * from "./types";
export { simulateGame } from "./engine";
export { fixtureSeed } from "./rng";

const skaterAttrs = (p: any): SkaterAttrs => ({
  ck: p.ck ?? 50, fg: p.fg ?? 50, di: p.di ?? 50, sk: p.sk ?? 50,
  st: p.st ?? 50, en: p.en ?? 50, du: p.du ?? 50, ph: p.ph ?? 50,
  fo: p.fo ?? 50, pa: p.pa ?? 50, sc: p.sc ?? 50, df: p.df ?? 50,
  ps: p.ps ?? 50, ex: p.ex ?? 50, ld: p.ld ?? 50, mo: p.mo ?? 50,
});

const goalieAttrs = (g: any): GoalieAttrs => ({
  sk: g?.sk ?? 50, du: g?.du ?? 50, en: g?.en ?? 50, sz: g?.sz ?? 50,
  ag: g?.ag ?? 50, rb: g?.rb ?? 50, sc: g?.sc ?? 50, hs: g?.hs ?? 50,
  rt: g?.rt ?? 50, ph: g?.ph ?? 50, ps: g?.ps ?? 50, ex: g?.ex ?? 50,
  ld: g?.ld ?? 50, mo: g?.mo ?? 50,
});

/**
 * Load a team's active NHL roster and assemble a SimTeam.
 * Uses rosterType='NHL' players; picks the best-overall goalie as starter.
 */
export async function loadSimTeam(teamId: number, rosterType?: string, opts?: { chemBase?: number; offPos?: { wing: number; center: number; def: number; chemCap: number } }): Promise<SimTeam> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { headCoach: true } });
  if (!team) throw new Error(`Team ${teamId} not found`);
  // AHL affiliates dress their AHL roster; NHL clubs their NHL roster
  const rt = rosterType ?? (team.league === "AHL" ? "AHL" : "NHL");

  const players = await prisma.player.findMany({
    where: { teamId, rosterType: rt, injuryDaysLeft: { lte: 0 } }, // injured players don't dress
    include: { goalieRating: true },
  });

  // A game needs a legal dressed roster: at least MIN_SKATERS skaters + MIN_GOALIES
  // goalies. If injuries/short rosters leave a club below the minimum, auto-fill
  // the missing spots with the best available call-ups from its AHL affiliate(s).
  // (Only the missing spots are filled — lines are NOT auto-generated.)
  const MIN_SKATERS = 18; // 12 F + 6 D — a legal 4-line / 3-pair lineup
  const MIN_F = 12;
  const MIN_D = 6;
  const MIN_GOALIES = 2;
  const isDef = (pos: string) => /(^|\/)D(\/|$)/.test(pos) || pos === "D";
  const affiliates = await prisma.team.findMany({ where: { parentTeamId: teamId }, select: { id: true } });
  const affIds = affiliates.map((a) => a.id);

  let skaterRows = players.filter((p) => !p.isGoalie);
  let nF = skaterRows.filter((p) => !isDef(p.position)).length;
  let nD = skaterRows.filter((p) => isDef(p.position)).length;
  if ((nF < MIN_F || nD < MIN_D || skaterRows.length < MIN_SKATERS) && affIds.length) {
    // pull the whole available affiliate skater pool once, then fill by position:
    // forwards up to MIN_F, defense up to MIN_D, then top up to MIN_SKATERS.
    const pool = await prisma.player.findMany({
      where: {
        teamId: { in: affIds }, isGoalie: false, injuryDaysLeft: { lte: 0 },
        id: { notIn: skaterRows.map((s) => s.id) },
      },
      include: { goalieRating: true },
      orderBy: { overall: "desc" },
    });
    const poolF = pool.filter((p) => !isDef(p.position));
    const poolD = pool.filter((p) => isDef(p.position));
    while (nF < MIN_F && poolF.length) { skaterRows.push(poolF.shift()!); nF++; }
    while (nD < MIN_D && poolD.length) { skaterRows.push(poolD.shift()!); nD++; }
    const rest = [...poolF, ...poolD].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
    while (skaterRows.length < MIN_SKATERS && rest.length) skaterRows.push(rest.shift()!);
  }
  // Manager lines (if set) — load now so their players are never trimmed below.
  const dbLines = await loadTeamLines(teamId);
  // Cap the dressed lineup at exactly a legal 12 F + 6 D so every dressed skater
  // gets real ice (4 lines / 3 pairs). Without this, a deep roster or stacked
  // call-ups leave a 13th/14th forward sitting with a zero-ice, zero-point
  // boxscore row — which is exactly why 4th-liners showed 15-24 GP. Extra healthy
  // bodies are the pressbox scratches (worst-overall first); players named in the
  // manager's lines are always kept.
  {
    const keep = new Set<number>();
    if (dbLines) {
      for (const l of dbLines.forwardLines) for (const id of [l.lw, l.c, l.rw]) if (id != null) keep.add(id);
      for (const p of dbLines.defensePairs) for (const id of [p.ld, p.rd]) if (id != null) keep.add(id);
    }
    const rank = (a: typeof skaterRows[number], b: typeof skaterRows[number]) =>
      (keep.has(b.id) ? 1 : 0) - (keep.has(a.id) ? 1 : 0) || (b.overall ?? 0) - (a.overall ?? 0);
    const fwds = skaterRows.filter((p) => !isDef(p.position)).sort(rank);
    const defs = skaterRows.filter((p) => isDef(p.position)).sort(rank);
    skaterRows = [...fwds.slice(0, MIN_F), ...defs.slice(0, MIN_D)];
  }
  // A disgruntled player (unhappy his ice-time promise was broken, trade requested)
  // plays at −20% across the board with sunken morale, until he's traded or the
  // role is honored — flags are cleared elsewhere, never a destructive edit here.
  const scaleAttrs = <T extends Record<string, any>>(a: T, f: number): T => {
    const out: any = { ...a };
    for (const k in out) if (typeof out[k] === "number") out[k] = Math.max(1, Math.round(out[k] * f));
    return out;
  };
  const skaters = skaterRows.map((p) => {
    const dis = (p as any).disgruntled === true;
    return buildSkater({
      id: p.id, name: p.name, position: p.position,
      overall: p.overall, attrs: dis ? scaleAttrs(skaterAttrs(p), 0.8) : skaterAttrs(p),
      con: p.condition ?? 100, morale: dis ? Math.min(p.morale ?? 75, 30) : (p.morale ?? 75),
      weight: p.weight ?? 200, shoots: p.shoots ?? null,
    });
  });

  const goalieRows = players.filter((p) => p.isGoalie);
  if (goalieRows.length < MIN_GOALIES && affIds.length) {
    const callups = await prisma.player.findMany({
      where: {
        teamId: { in: affIds }, isGoalie: true, injuryDaysLeft: { lte: 0 },
        id: { notIn: goalieRows.map((g) => g.id) },
      },
      include: { goalieRating: true },
      orderBy: { overall: "desc" },
      take: MIN_GOALIES - goalieRows.length,
    });
    goalieRows.push(...callups);
  }
  const goalies = goalieRows.map((g) => {
    const dis = (g as any).disgruntled === true;
    const ga = goalieAttrs(g.goalieRating ?? g);
    return buildGoalie({
      id: g.id, name: g.name, overall: g.overall,
      attrs: dis ? scaleAttrs(ga, 0.8) : ga,
      con: g.condition ?? g.goalieRating?.condition ?? 100,
      du: g.du ?? g.goalieRating?.du ?? ga.du,
      morale: dis ? Math.min(g.morale ?? 50, 30) : (g.morale ?? 50),
    });
  });

  // Roster gate. An NHL club ices a full 18+2, auto-filled from its AHL affiliate
  // when injuries leave it short. A game must NEVER be skipped for a thin roster:
  // if even the farm can't supply 12F/6D/2G, the deployment step below does an
  // emergency double-shift (a body fills two slots) so the lineup is always
  // legal and the game is played. We only refuse in a truly degenerate case
  // (almost no players at all) that no auto-fill can rescue.
  if (skaters.length < MIN_SKATERS || goalies.length < MIN_GOALIES) {
    console.warn(`[roster] ${team.name} thin lineup: ${skaters.length}/${MIN_SKATERS} skaters, ${goalies.length}/${MIN_GOALIES} G — auto-filling to a legal lineup.`);
  }
  if (skaters.length < 6 || goalies.length < 1) {
    throw new Error(`Team ${team.name} has too few players to dress (${skaters.length} skaters, ${goalies.length} goalies).`);
  }

  // Manager lines if set (loaded above), else position-aware auto lines (centers
  // at C, wingers on their natural side, D by shooting hand — off-position only
  // when a slot can't be filled). Either way the sim deploys realistic units.
  const lines = dbLines ?? autoLines(
    skaterRows.map((p) => ({ id: p.id, position: p.position ?? "C", overall: p.overall ?? 50, shoots: p.shoots })),
    goalieRows.map((g) => ({ id: g.id, overall: g.overall ?? 50 })),
  );
  // Guarantee a legal, fully-distinct 5v5 deployment (12 different forwards + 6
  // different D). Same helper the Lines display uses, so what's iced == what's
  // shown. See deployDistinct for the double-shift / thin-roster handling.
  {
    const byOv = (a: { overall: number | null }, b: { overall: number | null }) => (b.overall ?? 0) - (a.overall ?? 0);
    const dressedF = skaterRows.filter((p) => !isDef(p.position)).sort(byOv).map((p) => p.id);
    const dressedD = skaterRows.filter((p) => isDef(p.position)).sort(byOv).map((p) => p.id);
    deployDistinct(lines, dressedF, dressedD);
  }
  // current line chemistry (unit signature -> value); unseen units start at chemBase
  let chemistry: Record<string, number> = {};
  {
    const row = await prisma.teamLines.findUnique({ where: { teamId }, select: { chemistry: true } });
    chemistry = (row?.chemistry as Record<string, number> | null) ?? {};
  }
  const hc = team.headCoach;
  return buildTeam({
    id: team.id, name: team.name, code: team.code, skaters, goalies, lines,
    chemistry, chemBase: opts?.chemBase ?? 100, offPos: opts?.offPos,
    rivalTeamIds: (team as { rivalTeamIds?: number[] }).rivalTeamIds ?? [],
    coach: hc ? { style: hc.style, ph: hc.ph, df: hc.df, of: hc.of, pd: hc.pd, ex: hc.ex, ld: hc.ld } : null,
  });
}

/** Load both rosters and simulate a single game. */
export async function simulateFixture(
  homeId: number, awayId: number, seed?: number,
) {
  const [home, away] = await Promise.all([loadSimTeam(homeId), loadSimTeam(awayId)]);
  return simulateGame(home, away, { seed });
}
