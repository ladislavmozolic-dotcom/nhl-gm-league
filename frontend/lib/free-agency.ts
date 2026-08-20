// Free Agent Frenzy — market-value engine.
//
// Demands are NOT driven by the aggregate OV. They come from the sim-critical
// attributes (forwards: SC + PA, defense: DF + PA + point-shot SC, goalies:
// AG/RB/positioning), anchored to REAL comparable contracts (median cap hit of
// similarly-rated signed players), then adjusted for the player's age/trajectory
// ("will his parameters go up or down?"), his current-season production, and
// league cap growth. A league Agent / admin can override any demand.
//
// Everything here is deterministic and runs in-app — no external AI, so it is
// safe to run live for a whole free-agency period at once.

import { money } from "./finance";

export type FaPos = "F" | "D" | "G";
export const LEAGUE_MIN = 775_000;
export const MAX_TERM = 4; // our league caps contracts at 4 years (shorter than real NHL)

const n = (x: number | null | undefined, dflt = 50) => (typeof x === "number" ? x : dflt);

/** Coarse position bucket used for comparables + market weighting. */
export function faPosGroup(position: string | null | undefined, isGoalie: boolean): FaPos {
  if (isGoalie) return "G";
  const p = (position ?? "").toUpperCase();
  // pure defenseman = has D and no forward letter
  const isD = /\bD\b/.test(p) || (p.includes("D") && !p.includes("C") && !p.includes("W") && !p.includes("F"));
  return isD ? "D" : "F";
}

export type SkaterAttrs = { sc?: number | null; pa?: number | null; df?: number | null; sk?: number | null };
export type GoalieAttrs = { ag?: number | null; rb?: number | null; sc?: number | null; hs?: number | null };

/** Sim-weighted market rating — the value the SIMULATION actually rewards. */
export function skaterMarket(p: SkaterAttrs, grp: "F" | "D"): number {
  const sc = n(p.sc), pa = n(p.pa), df = n(p.df), sk = n(p.sk);
  if (grp === "D") return 0.40 * df + 0.30 * pa + 0.20 * sc + 0.10 * sk;
  return 0.42 * sc + 0.38 * pa + 0.12 * df + 0.08 * sk; // forward: offense-heavy
}
export function goalieMarket(g: GoalieAttrs): number {
  return 0.34 * n(g.ag) + 0.30 * n(g.sc) + 0.26 * n(g.rb) + 0.10 * n(g.hs);
}

/** One row of the "market" = every signed player's rating + what they earn. */
export type MarketRow = { grp: FaPos; market: number; capHit: number };

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)));
  return s[idx];
}

/** Open-market comparables sit above the median — a good UFA commands the upper
 *  part of his rating band, not the center (the median is pulled down by
 *  team-friendly / cost-controlled deals). */
export const ANCHOR_PCTL = 0.62;

/** UFA negotiations open HIGH (players test the market) and come down over the
 *  three weekly rounds toward fair value — round 1 asks ~+20%, round 3 is fair. */
export function roundPremium(round: number): number {
  if (round <= 1) return 1.20;
  if (round === 2) return 1.10;
  return 1.0; // round 3 = final week, fair value
}

/** The market anchor for a player: median cap hit of comparably-rated signings
 *  of the same position group. Widens the rating band until it has enough comps. */
export function anchorFromPool(
  pool: MarketRow[], grp: FaPos, market: number,
): { anchor: number; band: number; count: number } {
  const same = pool.filter((r) => r.grp === grp && r.capHit > 0);
  for (let band = 2.5; band <= 14; band += 2.5) {
    const comps = same.filter((r) => Math.abs(r.market - market) <= band);
    if (comps.length >= 5 || band >= 14) {
      const anchor = comps.length ? percentile(comps.map((c) => c.capHit), ANCHOR_PCTL) : (same.length ? percentile(same.map((c) => c.capHit), ANCHOR_PCTL) : 2_000_000);
      return { anchor, band, count: comps.length };
    }
  }
  return { anchor: 2_000_000, band: 14, count: 0 };
}

/** Age / trajectory multiplier — "will his parameters go up or down?".
 *  Young players on the rise command a premium (and want term); vets get docked. */
export function trendFactor(age: number | null | undefined): number {
  const a = age ?? 27;
  if (a <= 23) return 1.05;
  if (a <= 29) return 1.0;
  if (a <= 31) return 0.98;
  if (a <= 33) return 0.94;
  if (a <= 35) return 0.87;
  return 0.78;
}

/** Current-season production vs. expectation → ±. `pace` is points/GP (skaters)
 *  or SV% (goalies) already normalized to a 0.85..1.20 multiplier by the caller;
 *  pass 1 when there is no season sample yet. */
export function performanceFactor(pace: number | null | undefined): number {
  if (pace == null) return 1;
  return Math.max(0.85, Math.min(1.2, pace));
}

/** Term the player wants, bounded by his age. */
export function wantedYears(market: number, grp: FaPos, age: number | null | undefined): number {
  const a = age ?? 27;
  const base = grp === "G"
    ? (market >= 88 ? 4 : market >= 80 ? 4 : 3)
    : (market >= 70 ? 4 : market >= 62 ? 4 : market >= 55 ? 3 : 2);
  const ageCap = a >= 35 ? 1 : a >= 34 ? 2 : a >= 32 ? 3 : MAX_TERM;
  return Math.max(1, Math.min(base, ageCap, MAX_TERM));
}

export type Demand = {
  salary: number;       // headline asking cap hit
  years: number;        // headline asking term
  floorSalary: number;  // lowest cap hit he will sign for
  minYears: number;
  maxYears: number;
  market: number;       // his sim-weighted rating
  anchor: number;       // comparable-median cap hit before adjustments
  comps: number;        // how many comparables backed the anchor
  overridden: boolean;  // Agent/admin set this by hand
  willingness: number;  // morale/reputation multiplier on the ask (1 = neutral, >1 holding out, <1 eager)
};

// ---------------------------------------------------------------------------
// Morale / reputation → willingness to sign. A happy player is EAGER (takes a
// little less, signs sooner); an unhappy one holds out for more. A STAR (high
// market rating = "reputation") has the leverage to lean on his mood hard; a
// fringe player needs a job, so his mood barely moves the number.
// ---------------------------------------------------------------------------
export const MO_NEUTRAL = 70;
export function willingnessFactor(morale: number | null | undefined, market: number): number {
  if (morale == null) return 1;
  const moodDelta = (MO_NEUTRAL - morale) / MO_NEUTRAL;             // >0 = unhappy → wants more
  const reputation = Math.max(0, Math.min(1, (market - 55) / 35));  // rating 55→0 … 90→1 (star leverage)
  const leverage = 0.55 + 0.65 * reputation;                       // fringe 0.55 … star 1.2
  return Math.max(0.88, Math.min(1.16, 1 + moodDelta * 0.2 * leverage));
}
/** Salary multiplier for the OFFERED term vs the player's sweet spot. More years
 *  than he'd like → he wants a raise (steeper for older players who see the risk);
 *  fewer years → no premium (he's happy to go short). Never a refusal. */
export function termPremium(offerYears: number, preferredYears: number, age: number | null | undefined): number {
  const extra = offerYears - preferredYears;
  if (extra <= 0) return 1;
  const a = age ?? 27;
  // U-shape: a YOUNG player charges a lot to lock up his prime years, an OLDER one
  // charges for the risk of a long deal; a prime-age vet is the cheapest to extend.
  const perYear = a <= 25 ? 0.13 : a >= 33 ? 0.15 : a >= 30 ? 0.10 : 0.07;
  return 1 + extra * perYear;
}

/** Signing discount when the GM GRANTS a no-trade / no-movement clause: the
 *  player trades security for money, so he'll ink for a little less. NMC (full
 *  protection) is the biggest discount; M-NTC scales with how many teams the
 *  list covers (6 → small … 24 → nearly a full NTC). */
export function clauseDiscount(clause?: string | null, breadth?: number | null): number {
  if (clause === "NMC") return 0.08;
  if (clause === "NTC") return 0.05;
  if (clause === "M_NTC") return Math.max(0.015, Math.min(0.075, 0.10 * ((breadth ?? 12) / 32)));
  return 0;
}

/** Why a player would turn down a two-way offer (null = he'll take it).
 *
 *  The barrier is real NHL games played, NOT rating, and it only applies to OLDER
 *  players (26+): a player past 25 who logged more than 30 NHL games last season is
 *  an established NHLer and won't sign a two-way, whatever his overall (a proven
 *  role player at OV 58 still refuses). Young players are prospects — they go to the
 *  farm on two-way/ELC deals freely. When we have no imported GP, fall back to
 *  overall. Anyone who does take a two-way takes it only as a one-year deal.
 *
 *  `relaxOlder` lifts the older-player barrier — used on the open market from round
 *  2 on, when a veteran who drew no round-1 interest will settle for a two-way. */
export function twoWayObjection(
  twoWay: boolean,
  p: { overall?: number | null; lastSeasonGP?: number | null; age?: number | null },
  years: number,
  opts?: { relaxOlder?: boolean; olderAge?: number; gpLimit?: number; ovrFallback?: number; maxYears?: number },
): string | null {
  if (!twoWay) return null;
  const olderAge = opts?.olderAge ?? 25;
  const gpLimit = opts?.gpLimit ?? 30;
  const ovrFallback = opts?.ovrFallback ?? 72;
  const maxYears = opts?.maxYears ?? 1;
  const older = (p.age ?? 0) > olderAge;
  const provenNhl = p.lastSeasonGP != null ? p.lastSeasonGP > gpLimit : (p.overall ?? 70) >= ovrFallback;
  if (older && provenNhl && !opts?.relaxOlder) {
    return `He's past ${olderAge} and played ${gpLimit}+ NHL games last season — an established NHLer won't sign a two-way. Offer a one-way deal.`;
  }
  if (years > maxYears) {
    return maxYears <= 1 ? "He'll take a two-way, but only as a one-year deal — set the term to 1 year." : `He'll take a two-way, but only up to ${maxYears} years.`;
  }
  return null;
}

/** Short human note for the ask UI, e.g. "Unhappy — holding out (+9%)". */
export function willingnessNote(w: number): string | null {
  const pct = Math.round((w - 1) * 100);
  if (pct >= 4) return `Unhappy — holding out (+${pct}%)`;
  if (pct <= -4) return `Happy — eager to sign (${pct}%)`;
  return null;
}

export function buildDemand(input: {
  market: number; grp: FaPos; age: number | null | undefined;
  anchor: number; comps: number;
  perf?: number | null; capGrowth?: number; override?: number | null; downSeason?: boolean;
  morale?: number | null;
  round?: number;
  currentSalary?: number | null; // his existing cap hit — the opening ask won't come in under it
}): Demand {
  const { market, grp, age, anchor, comps } = input;
  const premium = roundPremium(input.round ?? 1); // default = opening ask (high)
  let salary: number;
  let overridden = false;
  if (input.override && input.override > 0) {
    salary = input.override * premium;
    overridden = true;
  } else {
    salary = anchor * trendFactor(age) * performanceFactor(input.perf) * (input.capGrowth ?? 1) * premium;
  }
  // morale/reputation bends the ask (skipped when an admin override is set exact).
  const willingness = overridden ? 1 : willingnessFactor(input.morale, market);
  salary *= willingness;
  // opening ask (round 1) never comes in UNDER his current pay — a re-signing player
  // wants at least a small raise, and more when he's producing (perf > 1).
  if (!overridden && (input.round ?? 1) <= 1 && input.currentSalary && input.currentSalary > 0) {
    const raise = 1.03 + Math.max(0, (input.perf ?? 1) - 1) * 0.6;
    salary = Math.max(salary, input.currentSalary * raise);
  }
  salary = Math.max(LEAGUE_MIN, Math.min(salary, 16_000_000));
  salary = Math.round(salary / 50_000) * 50_000;

  let years = wantedYears(market, grp, age);
  // term is ALWAYS negotiable up to the league cap — a longer deal just costs more
  // (see termPremium), the player never flat-refuses more years. He'll also go as
  // short as 1 year. Preferred `years` is his sweet spot; min/max frame the range.
  let maxYears = MAX_TERM;
  let minYears = 1;

  // coming off a down season (injury-hit / limited games) → his sweet spot is a
  // 1-year "prove-it" deal, but he'll still take term if you pay the premium.
  const downSeason = input.downSeason ?? (input.perf != null && input.perf < 0.9);
  if (downSeason) years = 1;

  const floorSalary = Math.round((salary * 0.92) / 50_000) * 50_000;
  return { salary, years, floorSalary, minYears, maxYears, market, anchor, comps, overridden, willingness };
}

// ---------------------------------------------------------------------------
// Team context — the SAME player asks for different money at different clubs,
// depending on the role he'd get and whether the team is a contender or rebuild.
// ---------------------------------------------------------------------------

export type LineSlot = "L1" | "L2" | "L3" | "L4" | "XF" | "P1" | "P2" | "P3" | "XD" | "G1" | "G2" | "G3";
export type Contention = "contender" | "middle" | "rebuild";

/** Where a player of `market` rating slots in on a team, given that team's
 *  same-position ratings (sorted desc). */
export function slotForRank(grp: FaPos, rankFromTop: number): LineSlot {
  if (grp === "G") return rankFromTop <= 1 ? "G1" : rankFromTop <= 2 ? "G2" : "G3";
  if (grp === "D") return rankFromTop <= 2 ? "P1" : rankFromTop <= 4 ? "P2" : rankFromTop <= 6 ? "P3" : "XD";
  return rankFromTop <= 3 ? "L1" : rankFromTop <= 6 ? "L2" : rankFromTop <= 9 ? "L3" : rankFromTop <= 12 ? "L4" : "XF";
}

export function slotLabel(slot: LineSlot): string {
  const m: Record<LineSlot, string> = {
    L1: "1st line", L2: "2nd line", L3: "3rd line", L4: "4th line", XF: "extra forward (press box)",
    P1: "top pairing", P2: "2nd pairing", P3: "3rd pairing", XD: "7th defenseman",
    G1: "starter", G2: "backup", G3: "3rd goalie",
  };
  return m[slot];
}

/** A bigger role → the player will take a bit LESS to get it; a smaller role → he
 *  wants a premium to accept it. Rebuild → premium; contender → discount. */
export function roleModifier(slot: LineSlot): number {
  switch (slot) {
    case "L1": case "P1": case "G1": return 0.90;
    case "L2": case "P2": return 0.97;
    case "G2": return 1.06;
    case "L3": case "P3": return 1.04;
    case "L4": return 1.10;
    default: return 1.22; // XF / XD / G3
  }
}
export function contentionModifier(c: Contention): number {
  return c === "contender" ? 0.94 : c === "rebuild" ? 1.10 : 1.0;
}

/** The player's team-specific ask: his open-market demand bent by role + contention. */
export function teamDemand(base: Demand, slot: LineSlot, c: Contention): Demand {
  const m = roleModifier(slot) * contentionModifier(c);
  const salary = Math.max(LEAGUE_MIN, Math.round((base.salary * m) / 50_000) * 50_000);
  const floorSalary = Math.max(LEAGUE_MIN, Math.round((base.floorSalary * m) / 50_000) * 50_000);
  return { ...base, salary, floorSalary };
}

/** When comparing standing offers, the player values a big role and a winner in
 *  $-equivalent terms — so a contender's 1st-line offer can beat a bigger cheque
 *  from a rebuild's 3rd line. */
export function contentionBonus(c: Contention): number {
  return c === "contender" ? 500_000 : c === "rebuild" ? -400_000 : 0;
}
/** Would the player sign this offer at this club at all? (clears team-specific floor + term.) */
export function offerAcceptable(td: Demand, offerSalary: number, offerYears: number): boolean {
  return offerSalary >= td.floorSalary && offerYears >= td.minYears && offerYears <= td.maxYears;
}

// ---------------------------------------------------------------------------
// Deployment / ice-time — the GM must tell the player how he'll be used (which
// line, and PP / PK). The player proposes a role from his own attributes + fit,
// and a promise of a bigger role (or the special-teams time his game fits) lets
// the GM sign him for less. High-SC/PA players covet PP; high-DF players value PK.
// ---------------------------------------------------------------------------

export type Deployment = { line: number; pp: boolean; pk: boolean }; // F line 1-4 · D pair 1-3 · G 1-2
export type Desired = { line: number; wantPP: boolean; wantPK: boolean };

export function slotToLine(slot: LineSlot): number {
  switch (slot) {
    case "L1": case "P1": case "G1": return 1;
    case "L2": case "P2": case "G2": return 2;
    case "L3": case "P3": return 3;
    case "L4": return 4;
    default: return slot === "XD" ? 3 : slot === "XF" ? 4 : 3; // extras sit just below the last real slot
  }
}

/** What the player wants: at least his projected line, PP if he's a top-6/top-4
 *  talent, PK if his defensive game (DF) warrants it. */
export function desiredDeployment(grp: FaPos, projLine: number, df: number | null | undefined): Desired {
  return {
    line: projLine,
    wantPP: grp !== "G" && projLine <= 2,
    wantPK: grp !== "G" && (df ?? 0) >= 68,
  };
}

/** Money bend from the PROMISED line (bigger promised role → he takes less). */
export function deployRoleModifier(grp: FaPos, line: number): number {
  if (grp === "G") return line <= 1 ? 0.90 : 1.06;
  if (grp === "D") return line <= 1 ? 0.90 : line === 2 ? 0.97 : 1.06;
  return line <= 1 ? 0.90 : line === 2 ? 0.97 : line === 3 ? 1.04 : 1.10;
}
/** Special-teams promise vs. what he wants. */
export function stModifier(d: Desired, pp: boolean, pk: boolean): number {
  let m = 1;
  if (d.wantPP) m *= pp ? 0.98 : 1.06;
  if (d.wantPK) m *= pk ? 0.98 : 1.0;
  return m;
}

/** How the ask bends with the GAP between the role he wants and the role promised.
 *  Offer him a worse line than he wants → he demands a premium; a better line → a
 *  discount. (gap = promisedLine − desiredLine; positive = worse than wanted.) */
export function roleGapModifier(gap: number): number {
  if (gap <= -1) return 0.90; // a bigger role than he expected — he'll take less
  if (gap === 0) return 1.0;
  if (gap === 1) return 1.11;
  if (gap === 2) return 1.24;
  return 1.38; // buried 3+ lines below what he wants
}

/** Team-specific ask given a concrete deployment PROMISE (the GM's counter).
 *  A role worse than he wants raises his salary AND shortens the term he'll accept
 *  (he takes a short "prove-it" deal rather than commit long to a lesser role). */
export function deploymentDemand(base: Demand, grp: FaPos, dep: Deployment, desired: Desired, c: Contention): Demand {
  const gap = dep.line - desired.line;
  const m = roleGapModifier(gap) * stModifier(desired, dep.pp, dep.pk) * contentionModifier(c);
  const salary = Math.max(LEAGUE_MIN, Math.round((base.salary * m) / 50_000) * 50_000);
  const floorSalary = Math.max(LEAGUE_MIN, Math.round((base.floorSalary * m) / 50_000) * 50_000);
  const maxYears = gap > 0 ? Math.max(1, base.maxYears - gap) : base.maxYears;
  const years = Math.min(base.years, maxYears);
  const minYears = Math.min(base.minYears, maxYears);
  return { ...base, salary, floorSalary, years, minYears, maxYears };
}

export function deployRoleBonus(grp: FaPos, line: number): number {
  if (grp === "G") return line <= 1 ? 1_600_000 : -300_000;
  if (grp === "D") return line <= 1 ? 1_600_000 : line === 2 ? 700_000 : -200_000;
  return line <= 1 ? 1_600_000 : line === 2 ? 700_000 : line === 3 ? 0 : -600_000;
}
/** How attractive an offer is to the player when picking among clubs (with usage). */
export function offerUtility(offerSalary: number, grp: FaPos, dep: Deployment, desired: Desired, c: Contention): number {
  let u = offerSalary + deployRoleBonus(grp, dep.line) + contentionBonus(c);
  if (desired.wantPP && dep.pp) u += 400_000;
  if (desired.wantPK && dep.pk) u += 300_000;
  return u;
}

export type OfferResult =
  | { status: "accept"; salary: number; years: number }
  | { status: "counter"; salary: number; years: number; reason: string }
  | { status: "reject"; reason: string };

/** One negotiation round: the player accepts, counters, or walks. `round` is
 *  1-based (first offer = 1). Each round he softens a little; a repeated lowball
 *  or an endless back-and-forth ends the talks. */
export function evaluateOffer(d: Demand, offerSalary: number, offerYears: number, round: number): OfferResult {
  const yrOk = offerYears >= d.minYears && offerYears <= d.maxYears;
  const moneyOk = offerSalary >= d.floorSalary;
  if (moneyOk && yrOk) return { status: "accept", salary: offerSalary, years: offerYears };

  if (offerSalary < d.floorSalary * 0.75 && round >= 3)
    return { status: "reject", reason: "Talks broke down — the offer was never close to his value." };
  if (round >= 5)
    return { status: "reject", reason: "Negotiations dragged on too long — he signed elsewhere." };

  // soften the ask a touch each round, but never below the floor
  const soften = 1 - Math.min(0.05 * round, 0.15);
  const counterSalary = Math.max(
    d.floorSalary,
    Math.round((Math.max(offerSalary, d.floorSalary) * 0.4 + d.salary * soften * 0.6) / 50_000) * 50_000,
  );
  let years = offerYears;
  let reason: string;
  if (!moneyOk && !yrOk) {
    reason = offerYears < d.minYears ? "Wants more money and more term." : "Wants more money and a shorter deal.";
  } else if (!moneyOk) {
    reason = `Wants more money — around ${money(counterSalary)}.`;
  } else {
    years = Math.min(Math.max(offerYears, d.minYears), d.maxYears);
    reason = offerYears < d.minYears ? "Money's fine — wants more years for security." : "Money's fine — won't commit that long.";
  }
  return { status: "counter", salary: counterSalary, years, reason };
}
