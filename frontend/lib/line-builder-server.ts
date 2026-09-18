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

type Attrs = { pa: number; sc: number; sk: number; ck: number; df: number; st: number; fo: number; en: number; weight: number };
type P = { id: number; name: string; slug: string | null; position: string; shoots: string | null; overall: number; a: Attrs };
export type LineSlot = { role: string; id: number | null; name: string | null; slug: string | null; overall: number | null; offSlot: boolean };
export type LineProfile = { playmaking: number; shooting: number; skating: number; physical: number; defense: number };
export type PairBond = { label: string; value: number; gelled: boolean };
export type BuiltLine = {
  kind: "F" | "D"; index: number; slots: LineSlot[];
  chemistry: number; gelled: boolean; pairs: PairBond[]; tacticalFit: number; profile: LineProfile; summary: string;
};
export type TeamLineBuild = { forwards: BuiltLine[]; defense: BuiltLine[]; scale: LineProfile } | null;

const avg = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function profileOf(ps: P[]): LineProfile {
  return {
    playmaking: clamp(avg(ps.map((p) => p.a.pa))),
    shooting: clamp(avg(ps.map((p) => p.a.sc))),
    skating: clamp(avg(ps.map((p) => p.a.sk))),
    physical: clamp(avg(ps.map((p) => p.a.ck))),
    defense: clamp(avg(ps.map((p) => p.a.df))),
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

// The bars in the UI read as "how close to the league's best" rather than "how
// close to a theoretical 100" — no skater actually runs a rating near 100 on
// any of these, so a flat 0-100 scale made every line look weak on every bar.
// Ceiling = the single highest NHL rating anyone in the league carries in that
// attribute right now (e.g. McDavid's Playmaking), so a bar can actually reach
// full width for a truly elite unit. Always benchmarked against the NHL pool,
// even when viewing AHL lines, so "how far from the NHL's best" stays honest.
async function leagueMaxProfile(): Promise<LineProfile> {
  const agg = await prisma.player.aggregate({
    where: { rosterType: "NHL", isGoalie: false },
    _max: { pa: true, sc: true, sk: true, ck: true, df: true },
  });
  return {
    playmaking: agg._max.pa ?? 100, shooting: agg._max.sc ?? 100, skating: agg._max.sk ?? 100,
    physical: agg._max.ck ?? 100, defense: agg._max.df ?? 100,
  };
}

export async function teamLineBuilder(teamId: number, league = "NHL"): Promise<TeamLineBuild> {
  const rosterType = league === "AHL" ? "AHL" : "NHL";
  const [rows, scale] = await Promise.all([
    prisma.player.findMany({
      where: { teamId, rosterType, isGoalie: false, scratched: false },
      select: { id: true, name: true, slug: true, position: true, shoots: true, overall: true, pa: true, sc: true, sk: true, ck: true, df: true, st: true, fo: true, en: true, weight: true },
    }),
    leagueMaxProfile(),
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
    a: { pa: r.pa ?? 50, sc: r.sc ?? 50, sk: r.sk ?? 50, ck: r.ck ?? 50, df: r.df ?? 50, st: r.st ?? 50, fo: r.fo ?? 50, en: r.en ?? 50, weight: r.weight ?? 90 },
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
    const tacticalFit = tacticalFitForwards(ps.map(fitPlayer), tactics, l.puck);
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
    const tacticalFit = tacticalFitDefense(ps.map(fitPlayer), tactics, l.dzone);
    const { chemistry, gelled, pairs } = chemFor(slots.map((s) => ({ role: s.role, id: s.id })), tacticalFit);
    return { kind: "D", index: i, slots, chemistry, gelled, pairs, tacticalFit, profile, summary: summaryOf(profile, "D") };
  });

  return { forwards, defense, scale };
}
