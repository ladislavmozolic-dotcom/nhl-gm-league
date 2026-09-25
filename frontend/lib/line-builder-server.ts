// Line Builder — a read-only analytical view of a team's CURRENT lines (as set in
// the Line Editor). For each line it derives: chemistry, tactical fit, an offensive
// profile (Playmaking / Shooting / Skating / Physical / Defense) and a plain-
// language summary — so a GM can judge and experiment with combinations before a sim.

import { prisma } from "./prisma";
import { loadTeamLines, loadTeamSystem, autoLines } from "./sim/lines";
import { pairSig, unitChemistry } from "./sim/chemistry";
import { tacticalFitDefense, tacticalFitForwards, type TacticalFitPlayer } from "./sim/tactical-fit";
import { DEFAULT_TACTICS } from "./sim/tactics";
import { cleanName } from "./playerName";
import { percentileOf } from "./edge-params";
import { posGroup } from "./ratingBands";

type Attrs = { pa: number; sc: number; sk: number; ck: number; df: number; st: number; fo: number; en: number; weight: number; ph: number };
type P = { id: number; name: string; slug: string | null; position: string; shoots: string | null; overall: number; a: Attrs };
export type LineSlot = { role: string; id: number | null; name: string | null; slug: string | null; overall: number | null; offSlot: boolean };
export type LineProfile = { playmaking: number; shooting: number; skating: number; physical: number; defense: number };
export type PairBond = { label: string; value: number; gelled: boolean };
export type BuiltLine = {
  kind: "F" | "D"; index: number; slots: LineSlot[];
  chemistry: number; gelled: boolean; pairs: PairBond[]; tacticalFit: number; profile: LineProfile; summary: string;
};
export type TeamLineBuild = { forwards: BuiltLine[]; defense: BuiltLine[] } | null;

const avg = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// Each bar is a PERCENTILE against other NHL players at the same position group
// (forwards vs. forwards, defensemen vs. defensemen) — never a flat 0-100 or a
// raw rating average (see memory: composite-rating-scale-normalization — rank
// each player against his own distribution first, then average the ranks, not
// the raw numbers). 100 = nobody at that position rates higher right now; 50 =
// dead average for the position. Always benchmarked against the NHL pool, even
// when viewing AHL lines, so "how this pair stacks up" stays honest.
type RatingPop = { pa: number[]; sc: number[]; sk: number[]; ck: number[]; df: number[] };
async function positionPopulations(): Promise<{ F: RatingPop; D: RatingPop }> {
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

function profileOf(ps: P[], kind: "F" | "D", pops: { F: RatingPop; D: RatingPop }): LineProfile {
  const pop = kind === "D" ? pops.D : pops.F;
  const pctl = (key: keyof RatingPop, vals: number[]) => clamp(avg(vals.map((v) => percentileOf(v, pop[key]) * 100)));
  return {
    playmaking: pctl("pa", ps.map((p) => p.a.pa)),
    shooting: pctl("sc", ps.map((p) => p.a.sc)),
    skating: pctl("sk", ps.map((p) => p.a.sk)),
    physical: pctl("ck", ps.map((p) => p.a.ck)),
    defense: pctl("df", ps.map((p) => p.a.df)),
  };
}

function summaryOf(prof: LineProfile, kind: "F" | "D"): string {
  const traits: [string, number][] = [["playmaking", prof.playmaking], ["shooting", prof.shooting], ["skating", prof.skating], ["physical", prof.physical], ["defense", prof.defense]];
  const sorted = [...traits].sort((a, b) => b[1] - a[1]);
  const NM: Record<string, string> = { playmaking: "playmaking", shooting: "a shooting punch", skating: "skating speed", physical: "a physical edge", defense: "defensive responsibility" };
  const top = sorted[0], second = sorted[1], weak = sorted[sorted.length - 1];
  const grade = top[1] >= 82 ? "Elite" : top[1] >= 72 ? "Strong" : top[1] >= 62 ? "Solid" : "Depth";
  let s = `${grade} ${top[0] === "defense" ? "defensive" : top[0]} ${kind === "F" ? "line" : "pair"}`;
  if (second[1] >= 68) s += ` with ${NM[second[0]]}`;
  s += ".";
  if (weak[1] <= 45) s += ` Limited ${weak[0] === "physical" ? "physical puck recovery" : weak[0] === "defense" ? "defensive coverage" : weak[0]}.`;
  return s;
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

  const base = 46;
  // pairwise chemistry: each bond has its own value; the line's chemistry is the
  // average of its bonds. A bond with no shared history yet is "projected" from fit.
  const chemFor = (slots: { role: string; id: number | null }[], fit: number): { chemistry: number; gelled: boolean; pairs: PairBond[] } => {
    const present = slots.filter((s) => s.id != null) as { role: string; id: number }[];
    if (present.length < 2) return { chemistry: 0, gelled: false, pairs: [] };
    const proj = clamp(base + fit * 0.18);
    const pairs: PairBond[] = [];
    for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
      const stored = chem[pairSig(present[i].id, present[j].id)];
      pairs.push({ label: `${present[i].role}↔${present[j].role}`, value: stored != null ? clamp(stored) : proj, gelled: stored != null });
    }
    const members = present.map((s) => s.id);
    const anyStored = pairs.some((p) => p.gelled);
    const chemistry = anyStored ? clamp(unitChemistry(members, chem, base)) : proj;
    return { chemistry, gelled: anyStored, pairs };
  };

  const forwards: BuiltLine[] = (lines.forwardLines ?? []).map((l, i) => {
    const ps = [l.lw, l.c, l.rw].map((id) => (id != null ? byId.get(id) ?? null : null));
    const present = ps.filter((p): p is P => !!p);
    const roles = ["LW", "C", "RW"];
    const slots: LineSlot[] = ps.map((p, idx) => ({ role: roles[idx], id: p?.id ?? null, name: p?.name ?? null, slug: p?.slug ?? null, overall: p?.overall ?? null,
      offSlot: !!p && !(roles[idx] === "C" ? /C|F/.test((p.position || "").toUpperCase()) : ((p.position || "").toUpperCase().includes(roles[idx]) || /\bW\b|F/.test((p.position || "").toUpperCase()))) }));
    const profile = profileOf(present, "F", pops);
    const tacticalFit = tacticalFitForwards(ps.map(fitPlayer), tactics, l.puck, i);
    const { chemistry, gelled, pairs } = chemFor(slots.map((s) => ({ role: s.role, id: s.id })), tacticalFit);
    return { kind: "F", index: i, slots, chemistry, gelled, pairs, tacticalFit, profile, summary: summaryOf(profile, "F") };
  });

  const defense: BuiltLine[] = (lines.defensePairs ?? []).map((l, i) => {
    const ps = [l.ld, l.rd].map((id) => (id != null ? byId.get(id) ?? null : null));
    const present = ps.filter((p): p is P => !!p);
    const roles = ["LD", "RD"];
    const slots: LineSlot[] = ps.map((p, idx) => ({ role: roles[idx], id: p?.id ?? null, name: p?.name ?? null, slug: p?.slug ?? null, overall: p?.overall ?? null,
      offSlot: !!p && ((idx === 0 && p.shoots === "R") || (idx === 1 && p.shoots === "L")) }));
    const profile = profileOf(present, "D", pops);
    const tacticalFit = tacticalFitDefense(ps.map(fitPlayer), tactics, l.dzone, i);
    const { chemistry, gelled, pairs } = chemFor(slots.map((s) => ({ role: s.role, id: s.id })), tacticalFit);
    return { kind: "D", index: i, slots, chemistry, gelled, pairs, tacticalFit, profile, summary: summaryOf(profile, "D") };
  });

  return { forwards, defense };
}
