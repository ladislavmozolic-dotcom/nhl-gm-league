// Pure line-quality math shared by the server-side Line Builder (a team's saved
// lines, lib/line-builder-server.ts) and the client-side Line Fit Finder
// (hypothetical/scouting combos, components/LineFitFinder.tsx) — one source of
// truth so a saved line and a hypothetical preview of the same three players
// never disagree.

import { pairSig, unitChemistry } from "./chemistry";
import { percentileOf } from "../edge-params";

export type Attrs = { pa: number; sc: number; sk: number; ck: number; df: number; st: number; fo: number; en: number; weight: number; ph?: number };
export type FitPlayer = { id: number; name: string; slug: string | null; position: string; shoots: string | null; overall: number; a: Attrs };
export type LineSlot = { role: string; id: number | null; name: string | null; slug: string | null; overall: number | null; offSlot: boolean };
export type LineProfile = { playmaking: number; shooting: number; skating: number; physical: number; defense: number };
export type PairBond = { label: string; value: number; gelled: boolean };
export type RatingPop = { pa: number[]; sc: number[]; sk: number[]; ck: number[]; df: number[] };

const avg = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);
export const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// The GM-facing 100 = nobody at the position rates higher right now; 50 = dead
// average. See memory: composite-rating-scale-normalization — rank each player
// against his own position's distribution first, then average the ranks.
export function profileOf(ps: FitPlayer[], kind: "F" | "D", pops: { F: RatingPop; D: RatingPop }): LineProfile {
  const pop = kind === "D" ? pops.D : pops.F;
  const pctl = (key: keyof RatingPop, vals: number[]) => clamp100(avg(vals.map((v) => percentileOf(v, pop[key]) * 100)));
  return {
    playmaking: pctl("pa", ps.map((p) => p.a.pa)),
    shooting: pctl("sc", ps.map((p) => p.a.sc)),
    skating: pctl("sk", ps.map((p) => p.a.sk)),
    physical: pctl("ck", ps.map((p) => p.a.ck)),
    defense: pctl("df", ps.map((p) => p.a.df)),
  };
}

export function summaryOf(prof: LineProfile, kind: "F" | "D"): string {
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

export const CHEM_BASE = 46;

/** Pairwise chemistry: each bond has its own value; the line's chemistry is the
 *  average of its bonds. A bond with no shared history in `chem` yet — always
 *  true for a hypothetical/scouting combo — is "projected" from fit. */
export function chemFor(chem: Record<string, number>, slots: { role: string; id: number | null }[], fit: number, base = CHEM_BASE): { chemistry: number; gelled: boolean; pairs: PairBond[] } {
  const present = slots.filter((s) => s.id != null) as { role: string; id: number }[];
  if (present.length < 2) return { chemistry: 0, gelled: false, pairs: [] };
  const proj = clamp100(base + fit * 0.18);
  const pairs: PairBond[] = [];
  for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
    const stored = chem[pairSig(present[i].id, present[j].id)];
    pairs.push({ label: `${present[i].role}↔${present[j].role}`, value: stored != null ? clamp100(stored) : proj, gelled: stored != null });
  }
  const members = present.map((s) => s.id);
  const anyStored = pairs.some((p) => p.gelled);
  const chemistry = anyStored ? clamp100(unitChemistry(members, chem, base)) : proj;
  return { chemistry, gelled: anyStored, pairs };
}

/** Whether a forward slotted at `role` (LW/C/RW) is off his natural position. */
export function offSlotForward(role: string, position: string | null | undefined): boolean {
  const pos = (position || "").toUpperCase();
  const natural = role === "C" ? /C|F/.test(pos) : (pos.includes(role) || /\bW\b|F/.test(pos));
  return !natural;
}
/** Whether a defenseman slotted at LD/RD (index 0/1) is on his off side. */
export function offSlotDefense(idx: 0 | 1, shoots: string | null | undefined): boolean {
  return (idx === 0 && shoots === "R") || (idx === 1 && shoots === "L");
}
