// Line Builder — a read-only analytical view of a team's CURRENT lines (as set in
// the Line Editor). For each line it derives: chemistry, tactical fit, an offensive
// profile (Playmaking / Shooting / Transition / Physical / Defense) and a plain-
// language summary — so a GM can judge and experiment with combinations before a sim.

import { prisma } from "./prisma";
import { loadTeamLines, autoLines } from "./sim/lines";
import { pairSig, unitChemistry } from "./sim/chemistry";
import { cleanName } from "./playerName";

type Attrs = { pa: number; sc: number; sk: number; ck: number; df: number; st: number; fo: number; weight: number };
type P = { id: number; name: string; slug: string | null; position: string; shoots: string | null; overall: number; a: Attrs };
export type LineSlot = { role: string; id: number | null; name: string | null; slug: string | null; overall: number | null; offSlot: boolean };
export type LineProfile = { playmaking: number; shooting: number; transition: number; physical: number; defense: number };
export type PairBond = { label: string; value: number; gelled: boolean };
export type BuiltLine = {
  kind: "F" | "D"; index: number; slots: LineSlot[];
  chemistry: number; gelled: boolean; pairs: PairBond[]; tacticalFit: number; profile: LineProfile; summary: string;
};
export type TeamLineBuild = { forwards: BuiltLine[]; defense: BuiltLine[] } | null;

const avg = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// forward role from attrs (mirrors ratings.roleFitOf)
const fRole = (a: Attrs) => {
  const play = 0.6 * a.pa + 0.4 * a.fo, snipe = 0.6 * a.sc + 0.4 * a.sk, grind = 0.5 * a.ck + 0.3 * a.df + 0.2 * a.st;
  return play >= snipe && play >= grind ? "PLAY" : snipe >= grind ? "SNIPE" : "GRIND";
};
const dRole = (a: Attrs) => (0.5 * a.pa + 0.3 * a.sk + 0.2 * a.sc >= 0.5 * a.df + 0.3 * a.st + 0.2 * a.ck ? "OFD" : "DFD");

function profileOf(ps: P[]): LineProfile {
  return {
    playmaking: clamp(avg(ps.map((p) => p.a.pa))),
    shooting: clamp(avg(ps.map((p) => p.a.sc))),
    transition: clamp(avg(ps.map((p) => p.a.sk))),
    physical: clamp(avg(ps.map((p) => p.a.ck))),
    defense: clamp(avg(ps.map((p) => p.a.df))),
  };
}

function summaryOf(prof: LineProfile, kind: "F" | "D"): string {
  const traits: [string, number][] = [["playmaking", prof.playmaking], ["shooting", prof.shooting], ["transition", prof.transition], ["physical", prof.physical], ["defense", prof.defense]];
  const sorted = [...traits].sort((a, b) => b[1] - a[1]);
  const NM: Record<string, string> = { playmaking: "playmaking", shooting: "a shooting punch", transition: "transition speed", physical: "a physical edge", defense: "defensive responsibility" };
  const top = sorted[0], second = sorted[1], weak = sorted[sorted.length - 1];
  const grade = top[1] >= 82 ? "Elite" : top[1] >= 72 ? "Strong" : top[1] >= 62 ? "Solid" : "Depth";
  let s = `${grade} ${top[0] === "transition" ? "transition" : top[0] === "defense" ? "defensive" : top[0]} ${kind === "F" ? "line" : "pair"}`;
  if (second[1] >= 68) s += ` with ${NM[second[0]]}`;
  s += ".";
  if (weak[1] <= 45) s += ` Limited ${weak[0] === "physical" ? "physical puck recovery" : weak[0] === "defense" ? "defensive coverage" : weak[0]}.`;
  return s;
}

// tactical fit = role diversity (a balanced line) × position/handedness correctness
function tacticalFitF(ps: (P | null)[]): number {
  const present = ps.filter((p): p is P => !!p);
  if (present.length < 2) return 0;
  const roles = new Set(present.map((p) => fRole(p.a))).size;
  const roleScore = roles >= 3 ? 100 : roles === 2 ? 72 : 48;
  // position: c is a centre, wingers on a natural/either side
  const slots = ["LW", "C", "RW"]; let good = 0, n = 0;
  ps.forEach((p, i) => { if (!p) return; n++; const pos = (p.position || "").toUpperCase(); const want = slots[i];
    const ok = want === "C" ? /C|F/.test(pos) : (pos.includes(want) || /\bW\b|F/.test(pos) || pos === "LW/RW" || (want === "LW" && /L/.test(pos)) || (want === "RW" && /R/.test(pos)));
    if (ok) good++; });
  const posFactor = n ? 0.75 + 0.25 * (good / n) : 0.85;
  return clamp(roleScore * posFactor);
}
function tacticalFitD(pair: (P | null)[]): number {
  const present = pair.filter((p): p is P => !!p);
  if (present.length < 2) return 0;
  const mixed = new Set(present.map((p) => dRole(p.a))).size >= 2; // offensive + shutdown
  const roleScore = mixed ? 100 : 60;
  // handedness: LD shoots L, RD shoots R
  let good = 0; if (pair[0]?.shoots === "L") good++; if (pair[1]?.shoots === "R") good++;
  const posFactor = 0.78 + 0.22 * (good / 2);
  return clamp(roleScore * posFactor);
}

export async function teamLineBuilder(teamId: number, league = "NHL"): Promise<TeamLineBuild> {
  const rosterType = league === "AHL" ? "AHL" : "NHL";
  const rows = await prisma.player.findMany({
    where: { teamId, rosterType, isGoalie: false },
    select: { id: true, name: true, slug: true, position: true, shoots: true, overall: true, pa: true, sc: true, sk: true, ck: true, df: true, st: true, fo: true, weight: true },
  });
  if (!rows.length) return null;
  // the GM's saved lines, else the same position-aware auto lines the sim uses
  const saved = await loadTeamLines(teamId);
  const lines = saved ?? autoLines(rows.map((r) => ({ id: r.id, name: r.name, position: r.position, overall: r.overall ?? 0 })), []);
  const chemRow = await prisma.teamLines.findUnique({ where: { teamId }, select: { chemistry: true } });
  const chem = ((chemRow?.chemistry ?? {}) as Record<string, number>) || {};
  const byId = new Map<number, P>(rows.map((r) => [r.id, {
    id: r.id, name: cleanName(r.name), slug: r.slug, position: r.position, shoots: r.shoots, overall: r.overall ?? 0,
    a: { pa: r.pa ?? 50, sc: r.sc ?? 50, sk: r.sk ?? 50, ck: r.ck ?? 50, df: r.df ?? 50, st: r.st ?? 50, fo: r.fo ?? 50, weight: r.weight ?? 90 },
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
    const profile = profileOf(present);
    const tacticalFit = tacticalFitF(ps);
    const { chemistry, gelled, pairs } = chemFor(slots.map((s) => ({ role: s.role, id: s.id })), tacticalFit);
    return { kind: "F", index: i, slots, chemistry, gelled, pairs, tacticalFit, profile, summary: summaryOf(profile, "F") };
  });

  const defense: BuiltLine[] = (lines.defensePairs ?? []).map((l, i) => {
    const ps = [l.ld, l.rd].map((id) => (id != null ? byId.get(id) ?? null : null));
    const present = ps.filter((p): p is P => !!p);
    const roles = ["LD", "RD"];
    const slots: LineSlot[] = ps.map((p, idx) => ({ role: roles[idx], id: p?.id ?? null, name: p?.name ?? null, slug: p?.slug ?? null, overall: p?.overall ?? null,
      offSlot: !!p && ((idx === 0 && p.shoots === "R") || (idx === 1 && p.shoots === "L")) }));
    const profile = profileOf(present);
    const tacticalFit = tacticalFitD(ps);
    const { chemistry, gelled, pairs } = chemFor(slots.map((s) => ({ role: s.role, id: s.id })), tacticalFit);
    return { kind: "D", index: i, slots, chemistry, gelled, pairs, tacticalFit, profile, summary: summaryOf(profile, "D") };
  });

  return { forwards, defense };
}
