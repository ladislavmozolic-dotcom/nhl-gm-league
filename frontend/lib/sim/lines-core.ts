// Pure lines/strategy model + auto-fill logic (no prisma) — safe to import in
// client components (the line editor) and on the server.

import type { GameStrategy } from "./types";
import { mergeTactics, type TeamTactics, type PuckStyle, type DZone } from "./tactics";

import type { LineTactic } from "./types";
export type { GameStrategy, StratWeights, LineTactic } from "./types";
// Per-line tactic (STHS): PHY = physical/forecheck, DF = defensive commitment,
// OF = offensive push. Small integers (0-5). Neutral baseline is PHY 1 / DF 2 / OF 2.
export const NEUTRAL_TACTIC: LineTactic = { phy: 1, df: 2, of: 2 };
export type ForwardLine = { lw: number | null; c: number | null; rw: number | null; timePct: number; tactic?: LineTactic; puck?: PuckStyle };
export type DefensePair = { ld: number | null; rd: number | null; timePct: number; tactic?: LineTactic; dzone?: DZone };
/** A generic ordered special-teams / situational unit (slots + ice-time share + tactic). */
export type SpecialUnit = { players: (number | null)[]; timePct: number; tactic?: LineTactic; dTactic?: LineTactic };
export type Others = {
  starter: number | null; backup: number | null;
  extraForwards: (number | null)[]; // 3
  extraDefense: (number | null)[];   // 3
  subPP: number | null; subPK1: number | null; subPK2: number | null;
  shootout: (number | null)[];       // 5 (ordered)
};
export type LastMin = { off: (number | null)[]; def: (number | null)[] }; // 6 slots each

export type Situations = {
  pp: SpecialUnit[];        // 2 units × 5 slots (3F + 2D)
  fourVFour: SpecialUnit[]; // 2 units × 4 slots (2F + 2D)
  pk4: SpecialUnit[];       // 2 units × 4 slots (2F + 2D)
  pk3: SpecialUnit[];       // 2 units × 3 slots
  overtime: SpecialUnit[];  // 3 units × 3 slots (3 vs 3)
  others: Others;
  lastMin: LastMin;
};

export type TeamLinesData = {
  forwardLines: ForwardLine[];
  defensePairs: DefensePair[];
  situations: Situations;
  strategy: GameStrategy;
  system?: TeamTactics; // Phase 3 team-system dials (undefined = balanced defaults)
};

export const DEFAULT_STRATEGY: GameStrategy = {
  winning2: { phy: 0, df: 4, of: 1 },
  winning1: { phy: 1, df: 3, of: 1 },
  tied: { phy: 1, df: 2, of: 2 },
  losing1: { phy: 0, df: 2, of: 3 },
  losing2: { phy: 0, df: 1, of: 4 },
  goaliePull: { minGoals: 4, savePctUnder: 80, pullSec: 90 },
};

// STHS default line time-share %
const F_TIME = [34, 31, 22, 13];
const D_TIME = [39, 32, 29];
// Default per-line tactics: the top two forward lines push offense, the bottom
// two shift to a checking / defensive game; D pairs get more defensive down the
// depth chart. (Neutral CK 1 / DF 2 / OF 2 is the per-slot baseline.)
// Each tactic is a 5-POINT budget: PHY + DF + OF must total 5 (STHS rule).
const F_TACTIC: LineTactic[] = [
  { phy: 0, df: 1, of: 4 }, // 1st line — attack (5)
  { phy: 1, df: 1, of: 3 }, // 2nd line — attack (5)
  { phy: 1, df: 3, of: 1 }, // 3rd line — checking (5)
  { phy: 2, df: 2, of: 1 }, // 4th line — physical / energy (5)
];
const D_TACTIC: LineTactic[] = [
  { phy: 1, df: 2, of: 2 }, // top pair — two-way (5)
  { phy: 1, df: 3, of: 1 }, // 2nd pair — defensive (5)
  { phy: 1, df: 4, of: 0 }, // 3rd pair — shut-down (5)
];
// Situational unit tactics (match STHS defaults): PP all-out offense, PK locked
// down, 4v4 balanced, overtime wide open.
const PP_TACTIC: LineTactic = { phy: 0, df: 1, of: 4 };
const PK_TACTIC: LineTactic = { phy: 1, df: 4, of: 0 };
const EV44_TACTIC: LineTactic = { phy: 1, df: 2, of: 2 };
const OT_TACTIC: LineTactic = { phy: 0, df: 1, of: 4 };

const isD = (p: string) => /(^|\/)D(\/|$)/.test(p) || p === "D";
const isC = (p: string) => /(^|\/)C(\/|$)/.test(p) || p === "C";
const nSlots = (n: number): (number | null)[] => Array.from({ length: n }, () => null);
/** Coerce a slot list to exactly `n` slots (keep filled ids, pad with null, drop extra). */
const fitSlots = (arr: (number | null)[] | undefined, n: number): (number | null)[] =>
  Array.from({ length: n }, (_, i) => (arr && i < arr.length ? arr[i] : null));

export function emptySituations(): Situations {
  return {
    pp: [{ players: nSlots(5), timePct: 60, tactic: { ...PP_TACTIC } }, { players: nSlots(5), timePct: 40, tactic: { ...PP_TACTIC } }],
    fourVFour: [{ players: nSlots(4), timePct: 60, tactic: { ...EV44_TACTIC } }, { players: nSlots(4), timePct: 40, tactic: { ...EV44_TACTIC } }],
    pk4: [{ players: nSlots(4), timePct: 60, tactic: { ...PK_TACTIC } }, { players: nSlots(4), timePct: 40, tactic: { ...PK_TACTIC } }],
    pk3: [{ players: nSlots(3), timePct: 60, tactic: { ...PK_TACTIC } }, { players: nSlots(3), timePct: 40, tactic: { ...PK_TACTIC } }],
    overtime: [
      { players: nSlots(3), timePct: 45, tactic: { ...OT_TACTIC } },
      { players: nSlots(3), timePct: 33, tactic: { ...OT_TACTIC } },
      { players: nSlots(3), timePct: 22, tactic: { ...OT_TACTIC } },
    ],
    others: { starter: null, backup: null, extraForwards: nSlots(3), extraDefense: nSlots(3), subPP: null, subPK1: null, subPK2: null, shootout: nSlots(5) },
    lastMin: { off: nSlots(6), def: nSlots(5) }, // off = pulled goalie (6 skaters); def = goalie in net (5)
  };
}

type Skater = { id: number; position: string; overall: number; shoots?: string | null; df?: number | null };
type Goalie = { id: number; overall: number };

const isLWpos = (p: string) => p.includes("LW") || /(^|\/)L(\/|$)/.test(p);
const isRWpos = (p: string) => p.includes("RW") || /(^|\/)R(\/|$)/.test(p);
const isGenericF = (p: string) => /(^|\/)F(\/|$)/.test(p); // a listed generic forward
const isGenericW = (p: string) => /(^|\/)(W|F)(\/|$)/.test(p);
const isWinger = (p: string) => isLWpos(p) || isRWpos(p) || isGenericW(p);
// Slot eligibility — a player is only auto-placed where his listed position allows.
// A pure centre ("C") never fills a wing; a pure winger never fills centre. A
// generic F/W can slot anywhere up front.
const canCenter = (p: string) => isC(p) || isGenericF(p);
const canLeft = (p: string) => isLWpos(p) || isGenericW(p);
const canRight = (p: string) => isRWpos(p) || isGenericW(p);
// a forward's natural wing side (generic wingers / centers fall back to shoots)
const wingSide = (s: Skater): "L" | "R" => {
  const p = (s.position || "").toUpperCase();
  if (isLWpos(p) && !isRWpos(p)) return "L";
  if (isRWpos(p) && !isLWpos(p)) return "R";
  return s.shoots === "R" ? "R" : "L";
};
const dSide = (s: Skater): "L" | "R" => (s.shoots === "R" ? "R" : "L");

/**
 * Build default lines from a roster, position-aware: centers at C, wingers on
 * their natural side, D by shooting hand (L-shot = LD, R-shot = RD). A player is
 * only placed out of position once every natural fit for that slot is used up.
 */
export function autoLines(skaters: Skater[], goalies: Goalie[] = []): TeamLinesData {
  const fwd = skaters.filter((s) => !isD(s.position)).sort((a, b) => b.overall - a.overall);
  const def = skaters.filter((s) => isD(s.position)).sort((a, b) => b.overall - a.overall);
  const used = new Set<number>();
  const best = (pool: Skater[]) => pool.find((s) => !used.has(s.id));
  const take = (...pools: Skater[][]) => { // first natural fit, then any fallback
    for (const p of pools) { const s = best(p); if (s) { used.add(s.id); return s.id; } }
    return null;
  };
  const centers = fwd.filter((s) => canCenter(s.position));
  const leftW = fwd.filter((s) => canLeft(s.position) && wingSide(s) === "L");
  const rightW = fwd.filter((s) => canRight(s.position) && wingSide(s) === "R");
  const anyLeft = fwd.filter((s) => canLeft(s.position));   // includes RW/LW & generic
  const anyRight = fwd.filter((s) => canRight(s.position));
  const leftD = def.filter((s) => dSide(s) === "L");
  const rightD = def.filter((s) => dSide(s) === "R");

  const forwardLines: ForwardLine[] = [];
  for (let i = 0; i < 4; i++) {
    // strictly position-aware: C only from centre-eligible, wings only from
    // wing-eligible (natural side first). A slot with no eligible player stays
    // empty — a call-up prompt — rather than icing a man out of position.
    const c = take(centers);
    const lw = take(leftW, anyLeft);
    const rw = take(rightW, anyRight);
    forwardLines.push({ lw, c, rw, timePct: F_TIME[i], tactic: { ...F_TACTIC[i] } });
  }
  const defensePairs: DefensePair[] = [];
  for (let i = 0; i < 3; i++) {
    const ld = take(leftD, def);
    const rd = take(rightD, def);
    defensePairs.push({ ld, rd, timePct: D_TIME[i], tactic: { ...D_TACTIC[i] } });
  }

  const data: TeamLinesData = { forwardLines, defensePairs, situations: emptySituations(), strategy: DEFAULT_STRATEGY };
  const gk = [...goalies].sort((a, b) => b.overall - a.overall);
  data.situations.others.starter = gk[0]?.id ?? null;
  data.situations.others.backup = gk[1]?.id ?? null;
  return autoFill(data, skaters, goalies); // fill the special-teams / situational slots too
}

/**
 * Fill every empty slot with the best available player, each roster player used
 * AT MOST ONCE across the four forward lines and the three D pairs — no
 * double-shifting. If the roster is too thin to fill all twelve forward / six
 * defence slots, the extra slots are left EMPTY (a call-up prompt) rather than
 * repeating a body. Game-day completeness is handled separately by deployDistinct.
 */
export function autoFill(data: TeamLinesData, skaters: Skater[], goalies: Goalie[] = []): TeamLinesData {
  const d = structuredClone(data);
  const fwd = skaters.filter((s) => !isD(s.position)).sort((a, b) => b.overall - a.overall);
  const def = skaters.filter((s) => isD(s.position)).sort((a, b) => b.overall - a.overall);
  const all = [...skaters].sort((a, b) => b.overall - a.overall);
  const gk = [...goalies].sort((a, b) => b.overall - a.overall);

  // forwards: each forward appears at most once across all four lines, and only
  // in a slot his listed position allows (a centre is never dropped onto a wing).
  const fUsed = new Set<number>();
  for (const l of d.forwardLines) for (const id of [l.lw, l.c, l.rw]) if (id != null) fUsed.add(id);
  const pickF = (...pools: Skater[][]) => {
    for (const pool of pools) { const p = pool.find((f) => !fUsed.has(f.id)); if (p) { fUsed.add(p.id); return p.id; } }
    return null;
  };
  const centers = fwd.filter((s) => canCenter(s.position));
  const leftNatural = fwd.filter((s) => canLeft(s.position) && wingSide(s) === "L");
  const rightNatural = fwd.filter((s) => canRight(s.position) && wingSide(s) === "R");
  const anyLeft = fwd.filter((s) => canLeft(s.position));
  const anyRight = fwd.filter((s) => canRight(s.position));
  for (const line of d.forwardLines) {
    if (line.c == null) line.c = pickF(centers);
    if (line.lw == null) line.lw = pickF(leftNatural, anyLeft);
    if (line.rw == null) line.rw = pickF(rightNatural, anyRight);
  }

  // defense: each blue-liner used at most once across the three pairs
  const dUsed = new Set<number>();
  for (const p of d.defensePairs) for (const id of [p.ld, p.rd]) if (id != null) dUsed.add(id);
  const pickD = () => {
    const p = def.find((x) => !dUsed.has(x.id));
    if (p) { dUsed.add(p.id); return p.id; }
    return null;
  };
  for (const pair of d.defensePairs) {
    if (pair.ld == null) pair.ld = pickD();
    if (pair.rd == null) pair.rd = pickD();
  }

  // generic unit filler: dedups ACROSS every unit of the group (so unit 1 and
  // unit 2 never share a player — e.g. OT1 vs OT2), preferring `pool` then all
  // skaters. Hand-set players are kept and seed the used set.
  const fillUnits = (units: SpecialUnit[], pool: Skater[]) => {
    const used = new Set<number>();
    for (const u of units) for (const id of u.players) if (id != null) used.add(id);
    for (const u of units) {
      for (let i = 0; i < u.players.length; i++) {
        if (u.players[i] != null) continue;
        const p = pool.find((x) => !used.has(x.id)) ?? all.find((x) => !used.has(x.id));
        if (p) { u.players[i] = p.id; used.add(p.id); }
      }
    }
  };
  // PP / 4v4 / PK4: first slots forwards, last two defense. `fPool`/`dPool` are
  // pre-ordered for the role (PP by scoring, PK by defence). Players are deduped
  // ACROSS the units of the group so unit 1 and unit 2 are always different players,
  // and any ids in `usedF` (e.g. the PP forwards) are kept off the PK.
  const splitFill = (units: SpecialUnit[], nF: number, fPool: Skater[], dPool: Skater[], usedF = new Set<number>()) => {
    const usedD = new Set<number>();
    for (const u of units) {
      // seed the used sets with any hand-set players already in the unit
      u.players.forEach((id, i) => { if (id != null) (i < nF ? usedF : usedD).add(id); });
      for (let i = 0; i < u.players.length; i++) {
        if (u.players[i] != null) continue;
        const pool = i < nF ? fPool : dPool, used = i < nF ? usedF : usedD;
        const p = pool.find((x) => !used.has(x.id)) ?? all.find((x) => !used.has(x.id));
        if (p) { u.players[i] = p.id; used.add(p.id); }
      }
    }
  };
  const dfKey = (s: Skater) => s.df ?? 0;
  const fwdByDf = [...fwd].sort((a, b) => dfKey(b) - dfKey(a)); // defensive forwards first (for the PK)
  const defByDf = [...def].sort((a, b) => dfKey(b) - dfKey(a));
  splitFill(d.situations.pp, 3, fwd, def);           // PP: best forwards (overall) + best D
  splitFill(d.situations.fourVFour, 2, fwd, def);
  // PK: prefer the most defensive forwards, and NOT the PP forwards (both PP units)
  const ppFwds = new Set(d.situations.pp.flatMap((u) => u.players.slice(0, 3)).filter((x): x is number => x != null));
  splitFill(d.situations.pk4, 2, fwdByDf, defByDf, new Set(ppFwds));
  // PK3 (3-on-5) = 1 defensive forward + 2 defencemen, deduped across both units.
  splitFill(d.situations.pk3, 1, fwdByDf, defByDf, new Set(ppFwds));
  // Overtime (3-on-3): 3 skaters per unit, unit 1 ≠ unit 2.
  fillUnits(d.situations.overtime, all);

  // others
  const o = d.situations.others;
  if (o.starter == null) o.starter = gk[0]?.id ?? null;
  if (o.backup == null) o.backup = gk.find((g) => g.id !== o.starter)?.id ?? null;
  const fillList = (list: (number | null)[], pool: Skater[]) => {
    const used = new Set(list.filter((x): x is number => x != null));
    for (let i = 0; i < list.length; i++) if (list[i] == null) { const p = pool.find((x) => !used.has(x.id)); if (p) { list[i] = p.id; used.add(p.id); } }
  };
  fillList(o.extraForwards, fwd);
  fillList(o.extraDefense, def);
  if (o.subPP == null) o.subPP = fwd[0]?.id ?? null;
  if (o.subPK1 == null) o.subPK1 = def[0]?.id ?? null;
  if (o.subPK2 == null) o.subPK2 = def[1]?.id ?? null;
  fillList(o.shootout, all);

  // last minute: OFF pushes for the tie, DF protects — fill from best skaters
  fillList(d.situations.lastMin.off, all);
  fillList(d.situations.lastMin.def, all);
  return d;
}

/**
 * Force a legal, fully-distinct 5v5 deployment onto a set of lines: the dressed
 * forwards spread one-each across the 4 forward lines (12 DIFFERENT forwards),
 * and the dressed D across the 3 pairs (6 different). A manager may repeat a star
 * (a double-shift) or leave depth players out — STHS still dresses 12 different
 * forwards every night, so any duplicate / empty / non-dressed slot is swapped
 * for an un-deployed dressed skater (best-first). On a thin roster the distinct
 * pool runs out and the last slots fall back to a double-shift (a body in two
 * slots, never twice in one unit) so the lineup is always complete and no game
 * is ever skipped. `dressedF` / `dressedD` must be ordered best-first. Mutates
 * and returns `lines`. Used by BOTH the sim (loadSimTeam) and the Lines display
 * so what you see is exactly what was iced.
 */
export function deployDistinct(lines: TeamLinesData, dressedF: number[], dressedD: number[]): TeamLinesData {
  const fill = (units: Array<Record<string, number | null>>, slots: string[], dressed: number[]) => {
    const seen = new Set<number>();
    const ok = new Set(dressed);
    for (const u of units) for (const k of slots) {
      const id = u[k];
      if (id != null && ok.has(id) && !seen.has(id)) { seen.add(id); continue; }
      const next = dressed.find((d) => !seen.has(d)) ?? null;
      u[k] = next; if (next != null) seen.add(next);
    }
    // emergency double-shift for thin rosters — never leave a slot empty
    for (const u of units) {
      const inUnit = new Set(slots.map((k) => u[k]).filter((x): x is number => x != null));
      for (const k of slots) {
        if (u[k] != null) continue;
        const next = dressed.find((d) => !inUnit.has(d)) ?? dressed[0] ?? null;
        u[k] = next; if (next != null) inUnit.add(next);
      }
    }
  };
  fill(lines.forwardLines as unknown as Array<Record<string, number | null>>, ["lw", "c", "rw"], dressedF);
  fill(lines.defensePairs as unknown as Array<Record<string, number | null>>, ["ld", "rd"], dressedD);
  return lines;
}

/** Default per-line tactic by unit kind + depth index (STHS pattern). */
export const defaultTactic = (kind: "F" | "D" | "PP" | "PK" | "44" | "OT", i = 0): LineTactic => {
  if (kind === "F") return { ...(F_TACTIC[i] ?? NEUTRAL_TACTIC) };
  if (kind === "D") return { ...(D_TACTIC[i] ?? NEUTRAL_TACTIC) };
  if (kind === "PP") return { ...PP_TACTIC };
  if (kind === "PK") return { ...PK_TACTIC };
  if (kind === "OT") return { ...OT_TACTIC };
  return { ...EV44_TACTIC };
};
// Fill any missing per-unit tactic with the positional default (so legacy stored
// lines — saved before tactics existed — still show/deploy the top-offensive /
// bottom-defensive pattern instead of a flat neutral).
const withTactic = <T extends { tactic?: LineTactic }>(u: T, t: LineTactic): T => (u.tactic ? u : { ...u, tactic: t });

/** Migrate any partial/legacy stored data to the current full shape. */
export function normalize(data: Partial<TeamLinesData>): TeamLinesData {
  const base = emptySituations();
  const s = (data.situations ?? {}) as Partial<Situations>;
  const spec = (arr: SpecialUnit[] | undefined, fallback: SpecialUnit[], kind: "PP" | "PK" | "44" | "OT") => {
    // pad a legacy/short saved array up to the current default count (e.g. an
    // OT array saved back when there were only 2 units) instead of dropping it.
    const src = arr && arr.length ? (arr.length < fallback.length ? [...arr, ...fallback.slice(arr.length)] : arr) : fallback;
    return src.map((u) => withTactic(u, defaultTactic(kind)));
  };
  return {
    forwardLines: (data.forwardLines?.length ? data.forwardLines : []).map((l, i) => withTactic(l, defaultTactic("F", i))),
    defensePairs: (data.defensePairs?.length ? data.defensePairs : []).map((p, i) => withTactic(p, defaultTactic("D", i))),
    situations: {
      pp: spec(s.pp, base.pp, "PP"), fourVFour: spec(s.fourVFour, base.fourVFour, "44"), pk4: spec(s.pk4, base.pk4, "PK"),
      pk3: spec(s.pk3, base.pk3, "PK"), overtime: spec(s.overtime, base.overtime, "OT"),
      others: { ...base.others, ...(s.others ?? {}) },
      // off = pulled goalie (6 skaters); def = goalie in net (5). Coerce legacy 6-slot def.
      lastMin: {
        off: fitSlots(s.lastMin?.off ?? base.lastMin.off, 6),
        def: fitSlots(s.lastMin?.def ?? base.lastMin.def, 5),
      },
    },
    strategy: { ...DEFAULT_STRATEGY, ...(data.strategy ?? {}) } as GameStrategy,
    system: data.system ? mergeTactics(data.system) : undefined,
  };
}

