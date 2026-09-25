// Line Builder — a read-only analytical view of a team's CURRENT lines (as set in
// the Line Editor). For each line it derives: chemistry, tactical fit, an offensive
// profile (Playmaking / Shooting / Skating / Physical / Defense) and a plain-
// language summary — so a GM can judge and experiment with combinations before a sim.

import { prisma } from "./prisma";
import { loadTeamLines, loadTeamSystem, autoLines } from "./sim/lines";
import { tacticalFitDefense, tacticalFitForwards, type TacticalFitPlayer } from "./sim/tactical-fit";
import { DEFAULT_TACTICS } from "./sim/tactics";
import { cleanName } from "./playerName";
import { posGroup } from "./ratingBands";
import {
  profileOf, summaryOf, chemFor, offSlotForward, offSlotDefense, slotType,
  type FitPlayer as P, type LineSlot, type LineProfile, type PairBond, type RatingPop,
} from "./sim/line-fit-calc";

export type { LineSlot, LineProfile, PairBond };
export type BuiltLine = {
  kind: "F" | "D"; index: number; slots: LineSlot[];
  chemistry: number; gelled: boolean; pairs: PairBond[]; tacticalFit: number; profile: LineProfile; summary: string;
};
export type TeamLineBuild = { forwards: BuiltLine[]; defense: BuiltLine[] } | null;

// Each bar is a PERCENTILE against other NHL players at the same position group
// (forwards vs. forwards, defensemen vs. defensemen) — never a flat 0-100 or a
// raw rating average (see memory: composite-rating-scale-normalization — rank
// each player against his own distribution first, then average the ranks, not
// the raw numbers). 100 = nobody at that position rates higher right now; 50 =
// dead average for the position. Always benchmarked against the NHL pool, even
// when viewing AHL lines, so "how this pair stacks up" stays honest.
export async function positionPopulations(): Promise<{ F: RatingPop; D: RatingPop }> {
  const rows = await prisma.player.findMany({
    where: { rosterType: "NHL", isGoalie: false },
    select: { position: true, pa: true, sc: true, sk: true, ck: true, df: true },
  });
  const empty = (): RatingPop => ({ pa: [], sc: [], sk: [], ck: [], df: [] });
  const pops = { F: empty(), D: empty() };
  for (const r of rows) {
    const bucket = posGroup(r.position, false) === "D" ? pops.D : pops.F;
    if (r.pa != null) bucket.pa.push(r.pa);
    if (r.sc != null) bucket.sc.push(r.sc);
    if (r.sk != null) bucket.sk.push(r.sk);
    if (r.ck != null) bucket.ck.push(r.ck);
    if (r.df != null) bucket.df.push(r.df);
  }
  for (const pop of [pops.F, pops.D]) for (const key of ["pa", "sc", "sk", "ck", "df"] as const) pop[key].sort((a, b) => a - b);
  return pops;
}

const fitPlayer = (player: P | null): TacticalFitPlayer | null => player == null
  ? null
  : { ...player.a, position: player.position, shoots: player.shoots };

export async function teamLineBuilder(teamId: number, league = "NHL"): Promise<TeamLineBuild> {
  const rosterType = league === "AHL" ? "AHL" : "NHL";
  const [rows, pops] = await Promise.all([
    prisma.player.findMany({
      where: { teamId, rosterType, isGoalie: false, scratched: false },
      select: { id: true, name: true, slug: true, position: true, shoots: true, overall: true, pa: true, sc: true, sk: true, ck: true, df: true, st: true, fo: true, en: true, weight: true, ph: true },
    }),
    positionPopulations(),
  ]);
  if (!rows.length) return null;
  // the GM's saved lines, else the same position-aware auto lines the sim uses
  const saved = await loadTeamLines(teamId);
  const lines = saved ?? autoLines(rows.map((r) => ({ id: r.id, name: r.name, position: r.position, overall: r.overall ?? 0 })), []);
  const tactics = (await loadTeamSystem(teamId)) ?? DEFAULT_TACTICS;
  const chemRow = await prisma.teamLines.findUnique({ where: { teamId }, select: { chemistry: true } });
  const chem = ((chemRow?.chemistry ?? {}) as Record<string, number>) || {};
  const byId = new Map<number, P>(rows.map((r) => [r.id, {
    id: r.id, name: cleanName(r.name), slug: r.slug, position: r.position, shoots: r.shoots, overall: r.overall ?? 0,
    a: { pa: r.pa ?? 50, sc: r.sc ?? 50, sk: r.sk ?? 50, ck: r.ck ?? 50, df: r.df ?? 50, st: r.st ?? 50, fo: r.fo ?? 50, en: r.en ?? 50, weight: r.weight ?? 90, ph: r.ph ?? 75 },
  }]));

  const forwards: BuiltLine[] = (lines.forwardLines ?? []).map((l, i) => {
    const ps = [l.lw, l.c, l.rw].map((id) => (id != null ? byId.get(id) ?? null : null));
    const present = ps.filter((p): p is P => !!p);
    const roles = ["LW", "C", "RW"];
    const slots: LineSlot[] = ps.map((p, idx) => ({ role: roles[idx], id: p?.id ?? null, name: p?.name ?? null, slug: p?.slug ?? null, overall: p?.overall ?? null,
      offSlot: !!p && offSlotForward(roles[idx], p.position), type: slotType(p) }));
    const profile = profileOf(present, "F", pops);
    const tacticalFit = tacticalFitForwards(ps.map(fitPlayer), tactics, l.puck, i);
    const { chemistry, gelled, pairs } = chemFor(chem, slots.map((s) => ({ role: s.role, id: s.id })), tacticalFit);
    return { kind: "F", index: i, slots, chemistry, gelled, pairs, tacticalFit, profile, summary: summaryOf(profile, "F") };
  });

  const defense: BuiltLine[] = (lines.defensePairs ?? []).map((l, i) => {
    const ps = [l.ld, l.rd].map((id) => (id != null ? byId.get(id) ?? null : null));
    const present = ps.filter((p): p is P => !!p);
    const roles = ["LD", "RD"];
    const slots: LineSlot[] = ps.map((p, idx) => ({ role: roles[idx], id: p?.id ?? null, name: p?.name ?? null, slug: p?.slug ?? null, overall: p?.overall ?? null,
      offSlot: !!p && offSlotDefense(idx as 0 | 1, p.shoots), type: slotType(p) }));
    const profile = profileOf(present, "D", pops);
    const tacticalFit = tacticalFitDefense(ps.map(fitPlayer), tactics, l.dzone, i);
    const { chemistry, gelled, pairs } = chemFor(chem, slots.map((s) => ({ role: s.role, id: s.id })), tacticalFit);
    return { kind: "D", index: i, slots, chemistry, gelled, pairs, tacticalFit, profile, summary: summaryOf(profile, "D") };
  });

  return { forwards, defense };
}
