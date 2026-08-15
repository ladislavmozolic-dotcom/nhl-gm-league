// Maps raw STHS attributes -> sim-relevant abilities and team strengths.
// Attribute meanings (STHS):
//   Skater: CK checking, FG fighting, DI discipline, SK skating, ST strength,
//     EN endurance, DU durability, PH puckhandling, FO faceoffs, PA passing,
//     SC scoring, DF defense, PS penalty-shot, EX experience, LD leadership, MO morale
//   Goalie: SK skating, DU durability, EN endurance, SZ size, AG agility,
//     RB rebound, SC style, HS high-shots/hand-speed, RT reflexes, PH puckhandling, ...

import type {
  SimSkater, SimGoalie, SimTeam, SkaterAttrs, GoalieAttrs, CoachInput,
} from "./types";
import type { TeamLinesData } from "./lines";
import { buildUnits, depthChartUnits, playerChemistry, unitSignature } from "./chemistry";

const clamp = (v: number, lo = 20, hi = 99) => Math.max(lo, Math.min(hi, v));
const w = (parts: Array<[number, number]>) => {
  let sum = 0, wt = 0;
  for (const [val, weight] of parts) { sum += (val ?? 50) * weight; wt += weight; }
  return wt ? sum / wt : 50;
};

/** Finishing ability — how likely this player is to convert / be the scorer. */
export function finishing(a: SkaterAttrs): number {
  return clamp(w([[a.sc, 0.55], [a.ph, 0.2], [a.ps, 0.1], [a.sk, 0.15]]));
}

/** Playmaking ability — how likely this player earns an assist. */
export function playmaking(a: SkaterAttrs): number {
  return clamp(w([[a.pa, 0.55], [a.ph, 0.25], [a.sk, 0.2]]));
}

/** Defensive suppression — reduces opponent shot quality. */
export function defending(a: SkaterAttrs, isDefense: boolean): number {
  const base = w([[a.df, 0.45], [a.ck, 0.25], [a.sk, 0.15], [a.st, 0.15]]);
  return clamp(isDefense ? base * 1.05 : base * 0.9);
}

/** Goalie save skill on a ~40..99 scale. */
export function goalieQuality(a: GoalieAttrs, overall: number): number {
  const skill = w([
    [a.ag, 0.22], [a.rb, 0.18], [a.sz, 0.15], [a.hs, 0.15],
    [a.rt, 0.15], [a.sc, 0.1], [a.ph, 0.05],
  ]);
  // blend attribute-derived skill with the stored overall for stability
  return clamp(skill * 0.6 + (overall || skill) * 0.4);
}

// The DB's player OVERALL ratings are compressed (skater mean ~59, sd ~3.4) so
// elite teams barely separate. Stretch overall away from the mean so team quality
// (avgOV → who wins & climbs the standings) has a realistic spread. Attributes are
// left untouched so the shot/goal calibration holds; scoring concentration is
// handled by starExponent instead.
const OV_SPREAD = 1.2;
const stretchOV = (v: number, mean = 59) => Math.max(30, Math.min(99, mean + (v - mean) * OV_SPREAD));

export function buildSkater(row: {
  id: number; name: string; position: string; overall: number | null;
  attrs: SkaterAttrs; con?: number | null; morale?: number | null; weight?: number | null; shoots?: string | null;
}): Omit<SimSkater, "iceTime"> {
  const isDefense = /(^|\/)D(\/|$)/.test(row.position) || row.position === "D";
  const isCenter = /(^|\/)C(\/|$)/.test(row.position) || row.position === "C";
  const a = row.attrs;
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    isDefense,
    isCenter,
    overall: stretchOV(row.overall ?? 50),
    attrs: a,
    offense: finishing(a),
    playmaking: playmaking(a),
    defense: defending(a, isDefense),
    faceoff: clamp(a.fo ?? 50),
    discipline: clamp(a.di ?? 50),
    hitting: clamp(w([[a.ck, 0.7], [a.st, 0.3]])),
    blocking: clamp(w([[a.df, 0.6], [a.sk, 0.2], [a.st, 0.2]])),
    con: Math.max(1, Math.min(100, row.con ?? 100)),
    chem: 100, // set per-unit in buildTeam; 100 = no chemistry penalty
    roleFit: 1, // set per-unit in buildTeam; 1 = ideal role mix
    morale: Math.max(1, Math.min(100, row.morale ?? 75)),
    weight: row.weight ?? 200,
    shoots: row.shoots ?? null,
    offSide: false, // set in buildTeam from manager line/pair slots
    posPenalty: 1,
  };
}

export function buildGoalie(row: {
  id: number; name: string; overall: number | null; attrs: GoalieAttrs;
  con?: number | null; du?: number | null; morale?: number | null;
}): SimGoalie {
  return {
    id: row.id,
    name: row.name,
    overall: row.overall ?? 50,
    attrs: row.attrs,
    quality: goalieQuality(row.attrs, row.overall ?? 50),
    con: Math.max(1, Math.min(100, row.con ?? 100)),
    du: clamp(row.du ?? row.attrs.du ?? 50),
    fatigued: false,
    morale: Math.max(1, Math.min(100, row.morale ?? 50)),
  };
}

/**
 * Assign relative ice time within a team, STHS depth-chart style:
 * top forwards / D-men play more. Returns skaters sorted by ice time desc,
 * with iceTime normalized so forwards sum to 1 and defense sum to 1.
 */
export function assignIceTime(
  skaters: Array<Omit<SimSkater, "iceTime">>,
): SimSkater[] {
  const fwd = skaters.filter((s) => !s.isDefense)
    .sort((a, b) => b.overall - a.overall);
  const def = skaters.filter((s) => s.isDefense)
    .sort((a, b) => b.overall - a.overall);

  // depth weights: line 1 > line 2 > ... (forwards ~4 lines, D ~3 pairs)
  const fwdWeights = [1.0, 0.98, 0.95, 0.9, 0.9, 0.9, 0.72, 0.72, 0.72, 0.55, 0.55, 0.55];
  const defWeights = [1.0, 1.0, 0.85, 0.85, 0.68, 0.68, 0.5, 0.5];

  const norm = (arr: Array<Omit<SimSkater, "iceTime">>, weights: number[]): SimSkater[] => {
    const used = arr.map((s, i) => ({ s, wgt: (weights[i] ?? 0.4) * (0.6 + s.overall / 200) }));
    const total = used.reduce((t, x) => t + x.wgt, 0) || 1;
    return used.map(({ s, wgt }) => ({ ...s, iceTime: wgt / total }));
  };

  return [...norm(fwd, fwdWeights), ...norm(def, defWeights)];
}

/**
 * Assign ice time from manager-set lines. A player's share ∝ their line's
 * Time%. Players not dressed in any line are scratched (iceTime 0).
 */
export function assignIceTimeFromLines(
  skaters: Array<Omit<SimSkater, "iceTime">>,
  lines: TeamLinesData,
): SimSkater[] {
  const fTime = new Map<number, number>();
  const dTime = new Map<number, number>();
  for (const line of lines.forwardLines)
    for (const id of [line.lw, line.c, line.rw]) if (id != null) fTime.set(id, (fTime.get(id) ?? 0) + line.timePct);
  for (const pair of lines.defensePairs)
    for (const id of [pair.ld, pair.rd]) if (id != null) dTime.set(id, (dTime.get(id) ?? 0) + pair.timePct);
  // Double-shifting is legal (a coach can play a star in two lines for extra ice)
  // but real top forwards top out ~22-23 min and blue-liners lead the ice-time
  // charts. Cap a player's summed time-share so a double-shifted star gets a
  // modest bump (not a 35-min night) and defensemen still lead TOI. This bounds
  // both his ice-time AND his in-sim involvement (chances), not just the display.
  const F_TIME_CAP = 38; // ~22 min — just under a single top pair's 39 (~23 min)
  const D_TIME_CAP = 46;
  for (const [id, v] of fTime) fTime.set(id, Math.min(v, F_TIME_CAP));
  for (const [id, v] of dTime) dTime.set(id, Math.min(v, D_TIME_CAP));

  const fwd = skaters.filter((s) => !s.isDefense);
  const def = skaters.filter((s) => s.isDefense);
  const norm = (arr: Array<Omit<SimSkater, "iceTime">>, w: Map<number, number>): SimSkater[] => {
    const total = arr.reduce((t, s) => t + (w.get(s.id) ?? 0), 0) || 1;
    return arr.map((s) => ({ ...s, iceTime: (w.get(s.id) ?? 0) / total }));
  };
  return [...norm(fwd, fTime), ...norm(def, dTime)];
}

/** Team offense rating (0..~100): ice-time-weighted finishing + playmaking. */
export function teamOffense(skaters: SimSkater[]): number {
  let sum = 0, wt = 0;
  for (const s of skaters) {
    const contrib = s.offense * 0.6 + s.playmaking * 0.4;
    const it = s.iceTime * (s.isDefense ? 0.5 : 1); // forwards drive offense more
    sum += contrib * it; wt += it;
  }
  return wt ? sum / wt : 50;
}

/** Team defense rating (0..~100): ice-time-weighted defensive suppression. */
export function teamDefense(skaters: SimSkater[]): number {
  let sum = 0, wt = 0;
  for (const s of skaters) {
    const it = s.iceTime * (s.isDefense ? 1.3 : 0.8); // D drive defense more
    sum += s.defense * it; wt += it;
  }
  return wt ? sum / wt : 50;
}

// Role diversity of a unit (0..1). STHS rewards complementary roles: a forward
// line wants a playmaking C + a sniper + a grinder; a D pair wants an offensive
// quarterback + a stay-at-home defender. Three of the same type clash → low fit.
function roleFitOf(members: SimSkater[], isDef: boolean): number {
  if (members.length < 2) return 1;
  const roleOf = (s: SimSkater): string => {
    const a = s.attrs;
    if (isDef) {
      const off = 0.5 * (a.pa ?? 50) + 0.3 * (a.sk ?? 50) + 0.2 * (a.sc ?? 50);
      const def = 0.5 * (a.df ?? 50) + 0.3 * (a.st ?? 50) + 0.2 * (a.ck ?? 50);
      return off >= def ? "OFD" : "DFD";
    }
    const play = 0.6 * (a.pa ?? 50) + 0.4 * (a.fo ?? 50);
    const snipe = 0.6 * (a.sc ?? 50) + 0.4 * (a.sk ?? 50);
    const grind = 0.5 * (a.ck ?? 50) + 0.3 * (a.df ?? 50) + 0.2 * (a.st ?? 50);
    return play >= snipe && play >= grind ? "PLAY" : snipe >= grind ? "SNIPE" : "GRIND";
  };
  const distinct = new Set(members.map(roleOf)).size;
  if (isDef) return distinct >= 2 ? 1 : 0.4;                 // pair: mixed = 1, redundant = 0.4
  return distinct >= 3 ? 1 : distinct === 2 ? 0.6 : 0.25;   // trio: 3 roles = 1, 2 = 0.6, 1 = 0.25
}

// A player's natural positions (LW/C/RW for forwards; LD or RD for a D by shoots).
function naturalPositions(s: SimSkater): Set<string> {
  const pos = (s.position || "").toUpperCase();
  if (/D/.test(pos) && !/C|W/.test(pos)) return new Set([s.shoots === "R" ? "RD" : "LD"]);
  const out = new Set<string>();
  const universal = /(^|\/)F(\/|$)/.test(pos);
  if (universal || /C/.test(pos)) out.add("C");
  if (universal || pos.includes("LW") || /(^|\/)L(\/|$)/.test(pos) || /(^|\/)W(\/|$)/.test(pos)) out.add("LW");
  if (universal || pos.includes("RW") || /(^|\/)R(\/|$)/.test(pos) || /(^|\/)W(\/|$)/.test(pos)) out.add("RW");
  if (out.size === 0) out.add("C");
  return out;
}
// Severity of playing `slot` given natural positions → one of the STHS penalty tiers.
function positionSeverity(nat: Set<string>, slot: string, pen: { wing: number; center: number; def: number }): number {
  if (nat.has(slot)) return 0;
  const slotIsD = slot === "LD" || slot === "RD";
  const playerIsD = nat.has("LD") || nat.has("RD");
  if (slotIsD !== playerIsD) return pen.def;          // forward ↔ defense (extreme)
  if (slotIsD) return pen.wing;                        // wrong D side (off-hand)
  const wings = slot === "LW" || slot === "RW";
  const hasWing = nat.has("LW") || nat.has("RW");
  if (wings && hasWing) return pen.wing;              // wing ↔ opposite wing
  return pen.center;                                  // wing ↔ center
}

export function buildTeam(input: {
  id: number; name: string; code: string | null;
  skaters: Array<Omit<SimSkater, "iceTime">>;
  goalies: SimGoalie[];
  lines?: TeamLinesData | null;
  chemistry?: Record<string, number>;
  chemBase?: number;
  offPos?: { wing: number; center: number; def: number; chemCap: number };
  rivalTeamIds?: number[];
  coach?: CoachInput;
}): SimTeam {
  const roster = input.lines
    ? assignIceTimeFromLines(input.skaters, input.lines)
    : assignIceTime(input.skaters);
  const goalies = [...input.goalies].sort((a, b) => b.overall - a.overall);

  // line chemistry: tag each skater with their unit's current chemistry.
  // Prefer manager-set line units; otherwise fall back to depth-chart groupings
  // (roster is already ordered by ice time) so chemistry applies to every team.
  let units = buildUnits(input.lines);
  if (units.length === 0) {
    units = depthChartUnits(
      roster.filter((s) => !s.isDefense).map((s) => s.id),
      roster.filter((s) => s.isDefense).map((s) => s.id),
    );
  }
  const chemistry = { ...(input.chemistry ?? {}) };
  const chemMap = playerChemistry(units, chemistry, input.chemBase ?? 100);
  const byId = new Map(roster.map((s) => [s.id, s]));
  const roleFitMap = new Map<number, number>();
  for (const u of units) {
    const members = u.members.map((id) => byId.get(id)).filter((s): s is SimSkater => !!s);
    const fit = roleFitOf(members, u.isDef);
    for (const id of u.members) roleFitMap.set(id, fit);
  }
  for (const s of roster) { s.chem = chemMap.get(s.id) ?? 100; s.roleFit = roleFitMap.get(s.id) ?? 1; }

  // Graduated off-position penalty (manager lines only) — a defenseman's natural
  // side is his `shoots`, a forward's slots come from his `position`. Playing off
  // spot bakes a skill cut into his ratings/attrs (kept as `posPenalty` so PP/PK
  // can waive it), and the whole unit is flagged to cap its chemistry.
  const slowChem: string[] = [];
  const pen = { wing: input.offPos?.wing ?? 0.07, center: input.offPos?.center ?? 0.17, def: input.offPos?.def ?? 0.35 };
  const penalize = (s: SimSkater, slot: string, sev: number) => {
    if (sev <= 0) return;
    const cut = 1 - sev;
    s.offSide = true;
    s.posPenalty = Math.min(s.posPenalty, cut); // worst of multiple off-spots
    s.offense *= cut; s.playmaking *= cut; s.defense *= cut;
    s.attrs = { ...s.attrs, df: (s.attrs.df ?? 50) * cut, pa: (s.attrs.pa ?? 50) * cut, sk: (s.attrs.sk ?? 50) * cut, sc: (s.attrs.sc ?? 50) * cut, st: (s.attrs.st ?? 50) * cut };
    // faceoff catastrophe: a winger forced to center wins draws at rock-bottom
    if (slot === "C" && !naturalPositions(s).has("C")) s.faceoff = Math.min(s.faceoff, 30);
  };
  const applySlots = (slots: [number | null, string][], sig: (number | null)[]) => {
    let off = false;
    for (const [id, slot] of slots) {
      const s = id != null ? byId.get(id) : undefined;
      if (!s) continue;
      const sev = positionSeverity(naturalPositions(s), slot, pen);
      if (sev > 0) { penalize(s, slot, sev); off = true; }
    }
    if (off) slowChem.push(unitSignature(sig));
  };
  for (const pair of input.lines?.defensePairs ?? [])
    applySlots([[pair.ld, "LD"], [pair.rd, "RD"]], [pair.ld, pair.rd]);
  for (const line of input.lines?.forwardLines ?? [])
    applySlots([[line.lw, "LW"], [line.c, "C"], [line.rw, "RW"]], [line.lw, line.c, line.rw]);

  // special-teams chemistry: a PP1 / PK1 unit made of already-gelled 5v5 players
  // is far more effective. Carry the members' 5v5 chemistry into a unit factor
  // (centered ~65 so an average unit is neutral). Rewards "don't split your top
  // line onto the power play" — put the intact line on PP1 and it stays deadly.
  const unitChemFactor = (players: (number | null | undefined)[], swing: number) => {
    const chems = players.map((id) => (id != null ? byId.get(id)?.chem : undefined)).filter((c): c is number => c != null);
    if (!chems.length) return 1;
    const avg = chems.reduce((a, b) => a + b, 0) / chems.length;
    return 1 + swing * (avg - 65) / 35;
  };
  const ppChem = unitChemFactor(input.lines?.situations?.pp?.[0]?.players ?? [], 0.15);
  const pkChem = unitChemFactor(input.lines?.situations?.pk4?.[0]?.players ?? [], 0.12);

  // team quality: ice-time-weighted roster overall blended with the starter — the
  // metric the standings should track (a better team on paper finishes higher).
  let ovSum = 0, ovWt = 0;
  for (const s of roster) { const it = s.iceTime || 0.05; ovSum += s.overall * it; ovWt += it; }
  const avgOV = (ovWt ? ovSum / ovWt : 60) * 0.82 + (goalies[0]?.overall ?? 75) * 0.18;

  // strategy tilt: a defensively-set team (tied state) plays tighter
  let offenseRating = teamOffense(roster);
  let defenseRating = teamDefense(roster);
  if (input.lines?.strategy) {
    const t = input.lines.strategy.tied;
    const ofTilt = (t.of + 1) / (t.of + t.df + 2); // 0..1, 0.5 = balanced
    offenseRating *= 0.9 + 0.2 * ofTilt;
    defenseRating *= 0.9 + 0.2 * (1 - ofTilt);
  }

  return {
    id: input.id,
    name: input.name,
    code: input.code,
    forwards: roster.filter((s) => !s.isDefense),
    defense: roster.filter((s) => s.isDefense),
    goalie: goalies[0],
    backup: goalies[1] ?? null,
    goalies,
    strategy: input.lines?.strategy ?? null,
    offenseRating,
    defenseRating,
    avgOV,
    units,
    chemistry,
    slowChem,
    ppChem,
    pkChem,
    rivalTeamIds: input.rivalTeamIds ?? [],
    shootoutOrder: (input.lines?.situations?.others?.shootout ?? []).filter((x): x is number => x != null),
    ...coachFactors(input.coach),
    fwdTactics: (input.lines?.forwardLines ?? []).map((l) => l.tactic ?? { phy: 1, df: 2, of: 2 }),
    defTactics: (input.lines?.defensePairs ?? []).map((p) => p.tactic ?? { phy: 1, df: 2, of: 2 }),
  };
}

// STHS coach → global team modifiers. Ratings sit ~75-92 (centered on 80), so a
// point above/below 80 nudges the team card; a matching coaching STYLE adds a
// little extra on top. Kept small so the roster stays the main driver.
function coachFactors(c: CoachInput): { coachOff: number; coachDef: number; coachDisc: number; coachEx: number } {
  if (!c) return { coachOff: 1, coachDef: 1, coachDisc: 1, coachEx: 70 };
  // centered on the league-average coach rating (~84) so a better-than-average
  // bench helps and a worse one hurts, but the pool stays ~zero-sum (no league-
  // wide scoring inflation just because coaches are rated in the 80s).
  const per = (v: number) => (v - 84) / 20 * 0.035;         // ±3.5% at a full 20-pt gap
  const styleOff = c.style === "Offensive" ? 0.012 : 0;
  const styleDef = c.style === "Defensive" ? 0.012 : 0;
  const stylePhy = c.style === "Physical" ? 0.03 : 0;       // physical bench = rougher, more PIM
  return {
    coachOff: Math.max(0.9, Math.min(1.1, 1 + per(c.of) + styleOff)),
    coachDef: Math.max(0.9, Math.min(1.1, 1 + per(c.df) + styleDef)),
    // high discipline (PD) → fewer penalties; a physical style pushes the other way
    coachDisc: Math.max(0.8, Math.min(1.2, 1 - (c.pd - 84) / 20 * 0.10 + stylePhy)),
    coachEx: c.ex,
  };
}
