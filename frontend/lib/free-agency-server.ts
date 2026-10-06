// Server-side glue for the Free Agent Frenzy engine: builds the "market" from
// every signed contract, then values free agents / re-sign candidates against it.

import { prisma } from "./prisma";
import { loadSettings } from "./sim/settings";
import { getLeagueClock } from "./calendar-server";
import { CURRENT_SEASON_START, ageAsOfJune30 } from "./finance";
import {
  faPosGroup, skaterMarket, goalieMarket, anchorFromPool, buildDemand, percentile, availabilityFactor, isDepthSlot,
  slotForRank, slotToLine, desiredDeployment, deploymentDemand, offerUtility, offerAcceptable, clauseDiscount, termPremium, lowballTier,
  NO_PROMISE_PREMIUM, type MarketRow, type Demand, type FaPos, type Contention, type Deployment, type Desired, type LineSlot,
  type FWeights, type DWeights, type GWeights,
} from "./free-agency";

/** Extensions are closed for the first `resignLockDays` days of the regular season
 *  (counted from the regular-season phase start). Returns the league date they open
 *  on while locked, else null. A club flagged `resignLockExempt` (commissioner
 *  override, e.g. for testing) skips the lock entirely regardless of the league-wide
 *  setting. */
export async function resignLockedUntil(teamId?: number): Promise<Date | null> {
  if (teamId != null) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { resignLockExempt: true } });
    if (team?.resignLockExempt) return null;
  }
  const s = await loadSettings();
  const days = Math.max(0, Math.round(s.resignLockDays ?? 0));
  if (!days) return null;
  const clock = await getLeagueClock();
  if (clock.phase !== "regular") return null;
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { regularPhaseAt: true } });
  if (!cfg?.regularPhaseAt) return null;
  const opens = new Date(cfg.regularPhaseAt.getTime() + days * 86_400_000);
  return clock.date.getTime() < opens.getTime() ? opens : null;
}

/** Current weekly negotiation round (1..3); 1 = opening ask outside the window. */
export async function currentFrenzyRound(): Promise<number> {
  return (await getLeagueClock()).frenzyRound || 1;
}

/** CBA max contract: 20 % of the league's upper cap. */
export function maxContract(): Promise<number> {
  return memoized("maxContract", 60_000, async () => Math.round(((await loadLeagueCap()).upper * 0.2) / 50_000) * 50_000);
}

export type LeagueCap = { mode: string; upper: number; lower: number; faOpen: boolean };

export async function loadLeagueCap(): Promise<LeagueCap> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const real = cfg?.rosterMode === "real";
  return {
    mode: cfg?.rosterMode ?? "profinhl",
    upper: real ? (cfg?.realCapUpper ?? 104_000_000) : (cfg?.profinhlCapUpper ?? 85_900_000),
    lower: real ? (cfg?.realCapLower ?? 76_500_000) : (cfg?.profinhlCapLower ?? 51_500_000),
    faOpen: !!cfg?.faOpen,
  };
}

const SEL = {
  id: true, isGoalie: true, position: true, age: true, capHit: true, rosterType: true,
  sc: true, pa: true, df: true, sk: true, lastSeasonGP: true, lastSeasonPts: true, lastSeasonSvPct: true, lastSeasonToi: true, morale: true,
  realCapHit: true,
  // the NEW real season, once it's ~10 games in — blended into performanceOf() alongside
  // last season so demands start reacting to this year's actual form, not just last year's.
  curSeasonGP: true, curSeasonG: true, curSeasonA: true, curSeasonToi: true, goalieAdvanced: true,
  // the Player Calculator's live blob (real current-season form → projected ratings) — feeds performanceOf()
  liveCalculatorRatings: true,
  goalieRating: { select: { ag: true, rb: true, sc: true, hs: true } },
} as const;

/** The "full slate" games played this season (p85 of everyone with a value) — a
 *  player who played well under this missed real time (injury/down year). */
// Short-lived memo for league-wide values that every single demand calculation
// re-reads (a page valuing ~60 offers used to scan the whole player table ~120×).
const memo = new Map<string, { at: number; v: Promise<unknown> }>();
function memoized<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as Promise<T>;
  const v = fn().catch((e) => { memo.delete(key); throw e; });
  memo.set(key, { at: Date.now(), v });
  return v;
}

export function leagueFullGP(): Promise<number> {
  return memoized("fullGP", 60_000, leagueFullGPUncached);
}
async function leagueFullGPUncached(): Promise<number> {
  const rows = await prisma.player.findMany({ where: { lastSeasonGP: { gt: 0 } }, select: { lastSeasonGP: true } });
  const gps = rows.map((r) => r.lastSeasonGP!).sort((a, b) => a - b);
  if (gps.length === 0) return 0;
  return gps[Math.floor(gps.length * 0.85)] || gps[gps.length - 1];
}

/** Coming off a down season if he's played under 60% of the full slate. */
export function isDownSeason(lastSeasonGP: number | null | undefined, fullGP: number, goalie = false): boolean {
  // a goalie shares the net — 46 starts is a full workload for him, not a down year
  return fullGP > 0 && lastSeasonGP != null && lastSeasonGP > 0 && lastSeasonGP < (goalie ? 0.35 : 0.6) * fullGP;
}

/** Distinct clubs with an active bid on each player in the round BEFORE `round`
 *  (i.e. round-1) — the signal roundPremium uses to soften a cold player's ask or
 *  let a contested one climb. Empty for round 1 (no prior round exists yet). One
 *  batched query for however many players are asked about at once. */
async function priorRoundBidderCounts(playerIds: number[], round: number): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (round <= 1 || playerIds.length === 0) return out;
  const rows = await prisma.faBid.groupBy({ by: ["playerId", "teamId"], where: { playerId: { in: playerIds }, round: round - 1 } });
  for (const r of rows) out.set(r.playerId, (out.get(r.playerId) ?? 0) + 1);
  return out;
}

/** A free agent still unsigned once the season is underway softens his asking price
 *  the deeper it gets (nobody's biting → he lowers his demands). 1 = no discount
 *  (off-season / Frenzy, which has its own round-by-round softening); down to ~0.55
 *  late in the year. */
export async function faStaleFactor(): Promise<number> {
  const clock = await getLeagueClock();
  if (clock.phase !== "regular" && clock.phase !== "playoffs") return 1;
  const agg = await prisma.game.aggregate({ _max: { round: true }, where: { season: "2026-27", status: "FINAL", league: "NHL", seriesId: null } });
  const dayIdx = agg._max.round ?? 0;              // game-days played this season
  const progress = Math.min(1, dayIdx / 60);        // ~60 game-days ≈ deep into the year
  return Math.max(0.55, 1 - 0.45 * progress);
}

const round50k = (v: number) => Math.max(775_000, Math.round(v / 50_000) * 50_000);
function scaleDemand(d: Demand, f: number): Demand {
  if (f >= 1) return d;
  return { ...d, salary: round50k(d.salary * f), floorSalary: round50k(d.floorSalary * f) };
}

type PoolPlayer = {
  isGoalie: boolean; position: string | null; capHit: number | null;
  sc: number | null; pa: number | null; df: number | null; sk: number | null;
  lastSeasonGP?: number | null; lastSeasonPts?: number | null; morale?: number | null;
  realCapHit?: number | null;
  goalieRating: { ag: number | null; rb: number | null; sc: number | null; hs: number | null } | null;
};

export type FaMarketWeights = { f: FWeights; d: DWeights; g: GWeights };
/** The league's currently-configured F/D/G market weights (Admin → FA Tuning). */
export async function loadFaWeights(): Promise<FaMarketWeights> {
  const s = await loadSettings();
  return { f: s.faWeightF, d: s.faWeightD, g: s.faWeightG };
}

/** Sim-weighted market rating for any player row (skater attrs or goalie card). */
export function playerMarket(p: PoolPlayer, w?: FaMarketWeights): { grp: FaPos; market: number } {
  const grp = faPosGroup(p.position, p.isGoalie);
  if (grp === "G") return { grp, market: goalieMarket(p.goalieRating ?? {}, w?.g) };
  return { grp, market: skaterMarket(p, grp, grp === "D" ? w?.d : w?.f) };
}

/** Every signed contract becomes one comparable row. */
export async function loadMarketPool(weights?: FaMarketWeights): Promise<MarketRow[]> {
  const signed = await prisma.player.findMany({
    where: { rosterType: { in: ["NHL", "AHL"] }, capHit: { gt: 0 }, contractYears: { gt: 0 } },
    select: SEL,
  });
  const w = weights ?? (await loadFaWeights());
  return signed.map((p) => {
    const { grp, market } = playerMarket(p as PoolPlayer, w);
    const ppg = grp !== "G" && (p.lastSeasonGP ?? 0) >= 20 ? (p.lastSeasonPts ?? 0) / p.lastSeasonGP! : null;
    const toi = grp !== "G" && (p.lastSeasonGP ?? 0) >= 20 && (p.lastSeasonToi ?? 0) > 0 ? p.lastSeasonToi : null;
    return { grp, market, capHit: p.capHit ?? 0, ppg, toi, age: p.age };
  });
}

/** Elite ladder. Every signed player of a position gets a star score = 75 % rating
 *  rank + 25 % production rank (points/GP, 40+ GP); the top 7 % are ranked and paid
 *  off the MAX contract, in order — the league's best D (Makar) asks more than the
 *  2nd-best (Werenski), who asks more than the 3rd… Rank 1 ≈ 95 % of max, the edge
 *  of the top 7 % ≈ 45 %. Fades from 34; goalies get a flatter ladder. 0 = not elite. */
const scoreCache = new WeakMap<MarketRow[], Map<FaPos, number[]>>();
function groupScores(pool: MarketRow[], grp: FaPos): { scoreOf: (market: number, ppg: number | null) => number; sorted: number[] } {
  const same = pool.filter((r) => r.grp === grp);
  const markets = same.map((r) => r.market).sort((x, y) => x - y);
  const ppgs = same.filter((r) => r.ppg != null).map((r) => r.ppg!).sort((x, y) => x - y);
  const below = (arr: number[], v: number) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo / Math.max(1, arr.length); };
  const scoreOf = (market: number, ppg: number | null) => {
    const rp = below(markets, market);
    const pp = grp === "G" || ppg == null || ppgs.length < 20 ? rp : below(ppgs, ppg);
    return 0.75 * rp + 0.25 * pp;
  };
  let cache = scoreCache.get(pool);
  if (!cache) { cache = new Map(); scoreCache.set(pool, cache); }
  let sorted = cache.get(grp);
  if (!sorted) { sorted = same.map((r) => scoreOf(r.market, r.ppg ?? null)).sort((x, y) => y - x); cache.set(grp, sorted); }
  return { scoreOf, sorted };
}

/** Elite-ladder age curve — forwards and goalies fade a year earlier and drop
 *  faster (a 33-year-old's legs/reflexes are already the bigger question mark);
 *  defensemen, who typically peak later and age more gradually on skill/reads
 *  alone, get one extra year at full value and a gentler slope after. */
function eliteAgeScale(grp: FaPos, age: number): number {
  // top skaters (F and D) hold their value through 33 — Kucherov-type elite forwards
  // don't fall off a cliff; goalies keep the earlier fade below
  if (grp !== "G") {
    if (age <= 33) return 1;
    if (age === 34) return 0.85;
    if (age === 35) return 0.70;
    if (age === 36) return 0.55;
    return 0.40;
  }
  if (age <= 32) return 1;
  if (age === 33) return 0.80;
  if (age === 34) return 0.60;
  if (age === 35) return 0.45;
  return 0.30;
}

export function eliteTarget(
  p: { lastSeasonGP?: number | null; lastSeasonPts?: number | null; age?: number | null },
  grp: FaPos, market: number, pool: MarketRow[], maxSalary: number,
): number {
  const { scoreOf, sorted } = groupScores(pool, grp);
  if (sorted.length < 20) return 0;
  const ppg = grp !== "G" && (p.lastSeasonGP ?? 0) >= 40 ? (p.lastSeasonPts ?? 0) / p.lastSeasonGP! : null;
  const s = scoreOf(market, ppg);
  const rank = 1 + sorted.filter((x) => x > s + 1e-9).length;
  const nTop = Math.max(3, Math.ceil(sorted.length * 0.07));
  if (rank > nTop) return 0;
  const tier = 1 - (rank - 1) / nTop; // 1 = the best at his position
  const ageScale = eliteAgeScale(grp, p.age ?? 27);
  // goalies sit below skaters at every rung, not just at the very top — real
  // goalie deals top out well under the league's best skater deals AND a
  // "pretty good, not truly elite" goalie shouldn't be paid like one just for
  // clearing the top-7% cutoff. Same power curve as skaters (mid-tier gets
  // compressed toward the floor, not spread linearly) on a lower 22-52% band.
  // rank 1 (McDavid-tier) should sit right up against the max contract, not
  // noticeably under it — 95% of max, not 88%. The floor at the edge of the
  // top 7% is unchanged (only the span above it grew).
  const frac = grp === "G" ? 0.20 + 0.32 * Math.pow(tier, 1.3) : 0.45 + 0.50 * Math.pow(tier, 1.3);
  return Math.round((maxSalary * frac * ageScale) / 50_000) * 50_000;
}

/** Role anchor — what clubs pay players who DID what he did last season (similar
 *  points/GP and, when known, similar minutes), ELCs excluded (their pay is set by
 *  the CBA, not the market). Blended 50/50 with the rating anchor: ratings alone
 *  can't tell a bottom-pair D from a top-pair one earning twice as much. */
export function roleAnchor(
  p: { lastSeasonGP?: number | null; lastSeasonPts?: number | null; lastSeasonToi?: number | null },
  grp: FaPos, pool: MarketRow[],
): number | null {
  if (grp === "G" || (p.lastSeasonGP ?? 0) < 20) return null;
  const ppg = (p.lastSeasonPts ?? 0) / p.lastSeasonGP!;
  const toi = p.lastSeasonToi ?? null;
  const elc = (r: MarketRow) => r.capHit < 1_000_000 && (r.age ?? 30) <= 24;
  const ppgBand = grp === "D" ? 0.08 : 0.1, toiBand = grp === "D" ? 75 : 90;
  const comps = pool.filter((r) => r.grp === grp && r.ppg != null && !elc(r) && Math.abs(r.ppg - ppg) <= ppgBand
    && (toi == null || r.toi == null || Math.abs(r.toi - toi) <= toiBand));
  if (comps.length < 10) return null;
  return percentile(comps.map((c) => c.capHit), 0.55);
}

/** The Player Calculator's live read of this season: his projected ratings (what the real
 *  current-season stats imply) priced against his actual ratings on the SAME market curve.
 *  factor = anchor salary at the projected rating / anchor salary at the actual rating, clamped
 *  to 0.90–1.10 — a skater the live data says has become a better (worse) player asks more
 *  (less). Only for his NHL read; null without a blob / without the four rating inputs, and
 *  null for goalies. */
export function liveFormFactor(
  p: { liveCalculatorRatings?: unknown },
  grp: FaPos, market: number, pool: MarketRow[], w?: FaMarketWeights,
): { gp: number; factor: number } | null {
  const blob = p.liveCalculatorRatings as { classification?: string; nhlGpLatest?: number; nhlGpPrevious?: number; projected?: Record<string, number | null> } | null | undefined;
  if (!blob || blob.classification !== "NHL" || !blob.projected) return null;
  // latest === previous means the feed has no separate current-season sample yet (it fell back to
  // last season), so there is no live form to react to — leave him on the old path.
  if (blob.nhlGpLatest === blob.nhlGpPrevious) return null;
  // Goalies stay on their save-% path: the calculator's projected goalie ratings run ~7 points
  // below the STHS ratings across the board, so reading them as "form" would cut every goalie's price.
  if (grp === "G") return null;
  const pr = blob.projected;
  const v = (k: string) => (typeof pr[k] === "number" ? (pr[k] as number) : null);
  const sc = v("sc"), pa = v("pa"), df = v("df"), sk = v("sk");
  if (sc == null || pa == null || df == null || sk == null) return null;
  const projMarket = skaterMarket({ sc, pa, df, sk }, grp, grp === "D" ? w?.d : w?.f);
  // Price the rating change with the league's own slope (salary vs rating over every signed
  // player of his position) — smooth and monotone, unlike re-reading the comparable window,
  // which jumps whenever a neighbour changes.
  // …at half strength (a projection is still an estimate), capped at ±10 %.
  const factor = Math.exp(0.5 * priceSlope(pool, grp) * (projMarket - market));
  return { gp: Number(blob.nhlGpLatest ?? 0), factor: Math.max(0.9, Math.min(1.1, factor)) };
}

const slopeCache = new WeakMap<MarketRow[], Map<FaPos, number>>();
/** d ln(cap hit) / d market-rating point, from a least-squares line through the signed pool. */
function priceSlope(pool: MarketRow[], grp: FaPos): number {
  let m = slopeCache.get(pool);
  if (!m) { m = new Map(); slopeCache.set(pool, m); }
  const hit = m.get(grp);
  if (hit != null) return hit;
  const rows = pool.filter((r) => r.grp === grp && r.capHit > 0);
  let slope = 0.05;
  if (rows.length >= 20) {
    const xs = rows.map((r) => r.market), ys = rows.map((r) => Math.log(r.capHit));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    if (sxx > 0) slope = Math.max(0.01, Math.min(0.12, sxy / sxx));
  }
  m.set(grp, slope);
  return slope;
}

/** Production vs. players rated like him → the demand's performance multiplier
 *  (1 = produced like his rating says). Skaters: points/GP against the same-rating
 *  comps (a D's points count less — his job isn't scoring). Goalies: save % against
 *  a league-average .903. No real sample → neutral.
 *
 *  Blends TWO samples: last season (the full, settled baseline) and the CURRENT
 *  real season once it has enough games to mean something (10+, matching the
 *  Player Calculator's own "projection activates at ~game 10" convention) — so a
 *  breakout or a slump this year moves his price during the season, not a year
 *  later. The current season's weight ramps from 0 at game 10 to fully replacing
 *  last season by game 41 (half a season) — early-season noise stays damped, a
 *  half-season sample is trusted on its own. */
export function performanceOf(
  p: {
    lastSeasonGP?: number | null; lastSeasonPts?: number | null; lastSeasonSvPct?: number | null; lastSeasonToi?: number | null;
    curSeasonGP?: number | null; curSeasonG?: number | null; curSeasonA?: number | null; curSeasonToi?: number | null;
    goalieAdvanced?: unknown;
    liveCalculatorRatings?: unknown;
  },
  grp: FaPos, market: number, pool: MarketRow[], w?: FaMarketWeights,
): number {
  // Prefer the Player Calculator's live read (projected vs actual ratings, with the real
  // current-season game count). Without a blob, fall back to the imported cur-season columns.
  const live = liveFormFactor(p, grp, market, pool, w);
  const curGp = live ? live.gp : (p.curSeasonGP ?? 0);
  const curWeight = Math.max(0, Math.min(1, (curGp - 10) / 31));

  if (grp === "G") {
    const goalieFactor = (sv: number | null | undefined, gp: number): number | null =>
      gp >= 10 && sv != null && sv > 0.8 ? Math.max(0.85, Math.min(1.15, 1 + (sv - 0.903) * 8)) : null;
    const lastF = (p.lastSeasonGP ?? 0) >= 15 ? goalieFactor(p.lastSeasonSvPct, p.lastSeasonGP ?? 0) : null;
    const adv = (p.goalieAdvanced ?? null) as { cur?: { svPct?: number; gp?: number } | null } | null;
    const curF = live ? (live.gp >= 10 ? live.factor : null) : goalieFactor(adv?.cur?.svPct, adv?.cur?.gp ?? 0);
    if (lastF == null) return curF ?? 1;
    if (curF == null) return lastF;
    return lastF * (1 - curWeight) + curF * curWeight;
  }

  const comps = pool.filter((r) => r.grp === grp && r.ppg != null && Math.abs(r.market - market) <= 3);
  const exp = comps.length >= 8 ? comps.reduce((t, r) => t + r.ppg!, 0) / comps.length : 0;
  const toiComps = comps.filter((r) => r.toi != null);
  const expToi = grp === "D" && toiComps.length >= 8 ? toiComps.reduce((t, r) => t + r.toi!, 0) / toiComps.length : 0;

  const skaterFactor = (gp: number, pts: number, toi: number | null | undefined): number | null => {
    if (gp < 1 || !(exp > 0.05)) return null;
    let f = 1 + ((pts / gp) / exp - 1) * (grp === "D" ? 0.25 : 0.45);
    // a D is paid for his minutes as much as his points — bottom-pair TOI ⇒ bottom-pair money
    if (grp === "D" && (toi ?? 0) > 0 && expToi > 0) f *= 1 + ((toi! / expToi) - 1) * 1.2;
    return Math.max(0.8, Math.min(1.2, f));
  };

  const lastF = (p.lastSeasonGP ?? 0) >= 20 ? skaterFactor(p.lastSeasonGP ?? 0, p.lastSeasonPts ?? 0, p.lastSeasonToi) : null;
  const curF = live ? (live.gp >= 10 ? live.factor : null) : (curGp >= 10 ? skaterFactor(curGp, (p.curSeasonG ?? 0) + (p.curSeasonA ?? 0), p.curSeasonToi) : null);
  if (lastF == null) return curF ?? 1;
  if (curF == null) return lastF;
  return lastF * (1 - curWeight) + curF * curWeight;
}

export type DemandFor = { demand: Demand; grp: FaPos };

/** Compute the contract demand for one player id (used by signing / extension). */
export async function demandForPlayerId(playerId: number, pool?: MarketRow[]): Promise<DemandFor | null> {
  const p = await prisma.player.findUnique({
    where: { id: playerId },
    select: { ...SEL, faDemandOverride: true },
  });
  if (!p) return null;
  const marketPool = pool ?? (await loadMarketPool());
  const fullGP = await leagueFullGP();
  const round = await currentFrenzyRound();
  const stale = await faStaleFactor();
  const priorBidders = (await priorRoundBidderCounts([playerId], round)).get(playerId);
  const weights = await loadFaWeights();
  return demandFromRow(p as PoolPlayer & { id: number; age: number | null; faDemandOverride: number | null }, marketPool, fullGP, round, stale, priorBidders, await maxContract(), weights);
}

function demandFromRow(
  p: PoolPlayer & { id: number; age: number | null; faDemandOverride: number | null },
  pool: MarketRow[], fullGP: number, round: number, stale = 1, priorBidders?: number, maxSalary = 16_000_000, weights?: FaMarketWeights,
): DemandFor {
  const { grp, market } = playerMarket(p, weights);
  const rated = anchorFromPool(pool, grp, market);
  const role = roleAnchor(p, grp, pool);
  const anchor = role != null ? (rated.anchor + role) / 2 : rated.anchor, count = rated.count;
  const demand = buildDemand({
    market, grp, age: p.age, anchor, comps: count,
    override: p.faDemandOverride, capGrowth: 1, round, priorBidders, perf: performanceOf(p, grp, market, pool, weights),
    availability: availabilityFactor(p.lastSeasonGP, fullGP, grp === "G"),
    eliteTarget: eliteTarget(p, grp, market, pool, maxSalary), maxSalary,
    downSeason: isDownSeason(p.lastSeasonGP, fullGP, grp === "G"), morale: p.morale, currentSalary: p.capHit,
    realCapHit: p.realCapHit,
  });
  // a manual override is the commissioner's word — never soften it
  if (p.faDemandOverride != null) return { demand, grp };
  const scaled = scaleDemand(demand, stale);
  // Veteran floor: a genuine NHL player — real games last season, UFA-age — doesn't sign
  // for the league minimum. And the floor is SEASON-AWARE: early in the year the market is
  // fresh and a declining vet (Jarnkrok, Hayes, Dumba) holds out for real money (~$2.25M);
  // as he stays unsigned it eases toward ~$1M by mid/late season. Derived from the same
  // `stale` progress signal (1.0 opening night → 0.55 deep in the year). Scrubs with no
  // NHL role fall below the GP bar and keep their low ask.
  const isNhlVet = (p.lastSeasonGP ?? 0) >= 10 && (p.age == null || p.age >= 27);
  if (isNhlVet) {
    const t = Math.max(0, Math.min(1, (stale - 0.55) / 0.45)); // 1 at opening night → 0 late
    const vetFloor = Math.round((VET_FLOOR_LATE + (VET_FLOOR_EARLY - VET_FLOOR_LATE) * t) / 50_000) * 50_000;
    if (scaled.floorSalary < vetFloor) {
      scaled.floorSalary = vetFloor;
      scaled.salary = Math.max(scaled.salary, vetFloor);
    }
  }
  return { demand: scaled, grp };
}
const VET_FLOOR_EARLY = 2_250_000; // opening-night floor for an NHL veteran UFA
const VET_FLOOR_LATE = 1_000_000;  // deep-in-the-season floor (market's gone cold)

// --- Team context: contention tier + where a free agent slots on a given club ---

/** Future-outlook score (0..1, relative to the other rebuild-tier clubs) for each
 *  team id in `teamIds`: how real is this rebuild's window, not just how bad is
 *  it today. Blends three forward-looking signals — nothing here reads current
 *  NHL performance, which teamContentionMap already scored separately:
 *   - prospect pool: the org's top-5 best prospects by quality, from BOTH
 *     prospect sources this app has — a drafted-but-not-yet-signed `Prospect`
 *     row (quality proxied by draft slot: a 1st overall projects far better than
 *     a 5th-rounder) and an already-signed `Player` row sitting at rosterType
 *     PROSPECT (quality = his actual computed OV). Same pool as the team's own
 *     /teams/[slug]/prospects page, so this reads the SAME prospects a GM sees there.
 *   - draft capital: owned picks over the next 3 drafts, weighted by round
 *     (a 1st is worth 5x a 5th-or-later — this is about high-end talent odds,
 *     not organizational pick COUNT)
 *   - core age: how young the CURRENT NHL roster already is (a young core has
 *     more years left to grow into the prospects' arrival)
 *  Each signal is normalized against the max within this rebuild group (not the
 *  whole league) so "rising" picks out the relatively promising half of THIS
 *  tier, the only place the distinction matters. */
async function teamOutlookScores(teamIds: number[], avgAgeById: Map<number, number>): Promise<Map<number, number>> {
  if (teamIds.length === 0) return new Map();
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const source = cfg?.rosterMode === "real" ? "real" : "profinhl";
  const [drafted, activated, picks] = await Promise.all([
    prisma.prospect.findMany({
      where: { teamId: { in: teamIds }, source },
      select: { teamId: true, overallPick: true, undrafted: true },
    }),
    prisma.player.findMany({
      where: { rosterType: "PROSPECT", teamId: { in: teamIds } },
      select: { teamId: true, overall: true },
    }),
    prisma.draftPick.findMany({
      where: { teamId: { in: teamIds }, year: { gt: CURRENT_SEASON_START, lte: CURRENT_SEASON_START + 3 } },
      select: { teamId: true, round: true },
    }),
  ]);
  // A drafted prospect has no rating yet — proxy his quality from where he was
  // picked (1st overall ≈ elite, mid-round tails off, undrafted/unknown = low).
  const pickSlotQuality = (overallPick: number | null, undrafted: boolean) =>
    undrafted || overallPick == null ? 35 : Math.max(30, Math.min(95, 95 - overallPick * 0.5));
  const prospectByTeam = new Map<number, number[]>();
  for (const p of drafted) {
    const a = prospectByTeam.get(p.teamId) ?? [];
    a.push(pickSlotQuality(p.overallPick, p.undrafted)); prospectByTeam.set(p.teamId, a);
  }
  for (const p of activated) {
    if (p.overall == null) continue;
    const a = prospectByTeam.get(p.teamId) ?? [];
    a.push(p.overall); prospectByTeam.set(p.teamId, a);
  }
  const pickWeight = (round: number) => Math.max(1, 6 - round); // 1st=5 · 2nd=4 · 3rd=3 · 4th=2 · 5th+=1
  const pickScoreByTeam = new Map<number, number>();
  for (const pk of picks) pickScoreByTeam.set(pk.teamId, (pickScoreByTeam.get(pk.teamId) ?? 0) + pickWeight(pk.round));

  const raw = teamIds.map((id) => {
    const top5 = (prospectByTeam.get(id) ?? []).sort((a, b) => b - a).slice(0, 5);
    const prospectScore = top5.length ? top5.reduce((a, b) => a + b, 0) / top5.length : 0;
    const pickScore = pickScoreByTeam.get(id) ?? 0;
    const ageScore = Math.max(0, 30 - (avgAgeById.get(id) ?? 27)); // younger core → higher
    return { id, prospectScore, pickScore, ageScore };
  });
  const norm = (xs: number[]) => { const max = Math.max(1e-6, ...xs); return xs.map((x) => x / max); };
  const prospectN = norm(raw.map((r) => r.prospectScore));
  const pickN = norm(raw.map((r) => r.pickScore));
  const ageN = norm(raw.map((r) => r.ageScore));
  const out = new Map<number, number>();
  raw.forEach((r, i) => out.set(r.id, 0.45 * prospectN[i] + 0.35 * pickN[i] + 0.20 * ageN[i]));
  return out;
}

/** Every NHL team's roster strength — mean OV of its top-18 skaters — with its average
 *  age, strongest first. The one measure behind the contender/rebuild split and the
 *  M-NTC "weakest clubs" list. */
async function rosterStrengthByTeam(): Promise<{ id: number; s: number; avgAge: number }[]> {
  const players = await prisma.player.findMany({
    where: { rosterType: "NHL", isGoalie: false }, select: { teamId: true, overall: true, age: true },
  });
  const byTeam = new Map<number, { ov: number[]; age: number[] }>();
  for (const p of players) {
    if (p.overall == null) continue;
    const e = byTeam.get(p.teamId) ?? { ov: [], age: [] };
    e.ov.push(p.overall);
    if (p.age != null) e.age.push(p.age);
    byTeam.set(p.teamId, e);
  }
  return [...byTeam.entries()].map(([id, e]) => {
    const top = [...e.ov].sort((a, b) => b - a).slice(0, 18);
    const avgAge = e.age.length ? e.age.reduce((a, b) => a + b, 0) / e.age.length : 27;
    return { id, s: top.reduce((x, y) => x + y, 0) / Math.max(1, top.length), avgAge };
  }).sort((a, b) => b.s - a.s);
}

/** Contender / middle / rebuild / rising for every NHL team. The base split is
 *  from CURRENT roster strength (mean OV of the top-18 skaters), thirds — same
 *  as before. The bottom third (the "rebuild" tier) is then split again by
 *  teamOutlookScores: the half of it with a real near-term window (prospects +
 *  picks + a young core) becomes "rising" instead of a plain "rebuild", so a
 *  young/unhappy free agent can weigh a genuine rebuild timeline against just
 *  chasing whichever club is best today (see contentionModifier/Bonus). */
export function teamContentionMap(): Promise<Map<number, Contention>> {
  return memoized("teamContentionMap", 60_000, teamContentionMapUncached);
}
async function teamContentionMapUncached(): Promise<Map<number, Contention>> {
  const strength = await rosterStrengthByTeam();
  const n = strength.length, third = Math.max(1, Math.round(n / 3));

  const rebuildTeams = strength.slice(n - third);
  const outlook = await teamOutlookScores(rebuildTeams.map((t) => t.id), new Map(strength.map((t) => [t.id, t.avgAge])));
  const outlookVals = [...outlook.values()].sort((a, b) => a - b);
  const outlookMedian = outlookVals.length ? outlookVals[Math.floor(outlookVals.length / 2)] : 0;

  const map = new Map<number, Contention>();
  strength.forEach((t, i) => {
    if (i < third) { map.set(t.id, "contender"); return; }
    if (i >= n - third) { map.set(t.id, (outlook.get(t.id) ?? 0) >= outlookMedian ? "rising" : "rebuild"); return; }
    map.set(t.id, "middle");
  });
  return map;
}

/** How often a team trades away players it controls, over the trailing ~9 months,
 *  scored relative to the league average (0 = at/under it, up to 1.5 = a serial
 *  flipper) — see churnModifier/churnBonus for how gently it bends a free agent's
 *  price and offer preference. A trade counts DOUBLE when the player it sends out
 *  had signed there as a free agent within the previous year — flipping a guy you
 *  just signed is the exact pattern that makes other players wary of signing there
 *  at all, so it weighs more than trading a long-tenured piece. */
export function teamChurnMap(): Promise<Map<number, number>> {
  return memoized("teamChurnMap", 60_000, teamChurnMapUncached);
}
async function teamChurnMapUncached(): Promise<Map<number, number>> {
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true } });
  const CHURN_WINDOW_DAYS = 270;
  const since = new Date(Date.now() - CHURN_WINDOW_DAYS * 86_400_000);
  const trades = await prisma.trade.findMany({
    where: { status: "ACCEPTED", createdAt: { gte: since } },
    select: { id: true, fromTeamId: true, toTeamId: true, createdAt: true },
  });
  const score = new Map<number, number>();
  if (trades.length) {
    const tradeById = new Map(trades.map((t) => [t.id, t]));
    const assets = await prisma.tradeAsset.findMany({
      where: { tradeId: { in: trades.map((t) => t.id) }, assetType: "PLAYER" },
      select: { tradeId: true, side: true, playerId: true },
    });
    const outgoing = assets
      .map((a) => {
        const t = tradeById.get(a.tradeId);
        if (!t || a.playerId == null) return null;
        return { teamId: a.side === "FROM" ? t.fromTeamId : t.toTeamId, playerId: a.playerId, tradedAt: t.createdAt };
      })
      .filter((x): x is { teamId: number; playerId: number; tradedAt: Date } => x != null);

    const codeById = new Map(teams.map((t) => [t.id, t.code]));
    const signings = outgoing.length
      ? await prisma.signingLog.findMany({
          where: { kind: "SIGN", reverted: false, playerId: { in: outgoing.map((o) => o.playerId) } },
          select: { playerId: true, teamCode: true, createdAt: true },
        })
      : [];
    const lastSignAt = new Map<string, Date>(); // key = `${playerId}:${teamCode}`
    for (const s of signings) {
      if (!s.teamCode) continue;
      const k = `${s.playerId}:${s.teamCode}`;
      const prev = lastSignAt.get(k);
      if (!prev || s.createdAt > prev) lastSignAt.set(k, s.createdAt);
    }
    for (const o of outgoing) {
      const code = codeById.get(o.teamId);
      const signedAt = code ? lastSignAt.get(`${o.playerId}:${code}`) : undefined;
      const flip = signedAt != null && o.tradedAt > signedAt && o.tradedAt.getTime() - signedAt.getTime() <= 365 * 86_400_000;
      score.set(o.teamId, (score.get(o.teamId) ?? 0) + (flip ? 2 : 1));
    }
  }
  const counts = teams.map((t) => score.get(t.id) ?? 0);
  const mean = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
  const churn = new Map<number, number>();
  for (const t of teams) churn.set(t.id, mean > 0 ? Math.max(0, Math.min(1.5, ((score.get(t.id) ?? 0) - mean) / mean)) : 0);
  return churn;
}

export type TeamContext = { contention: Contention; churn: number; markets: Record<FaPos, number[]> };

export async function loadTeamContext(teamId: number, cmap?: Map<number, Contention>, churnMap?: Map<number, number>): Promise<TeamContext> {
  const [roster, weights] = await Promise.all([
    prisma.player.findMany({ where: { teamId, rosterType: "NHL" }, select: SEL }),
    loadFaWeights(),
  ]);
  const markets: Record<FaPos, number[]> = { F: [], D: [], G: [] };
  for (const p of roster) {
    const { grp, market } = playerMarket(p as PoolPlayer, weights);
    markets[grp].push(market);
  }
  (Object.keys(markets) as FaPos[]).forEach((k) => markets[k].sort((a, b) => b - a));
  const contentionMap = cmap ?? (await teamContentionMap());
  const churns = churnMap ?? (await teamChurnMap());
  return { contention: contentionMap.get(teamId) ?? "middle", churn: churns.get(teamId) ?? 0, markets };
}

/** Where the player slots on this club: strictly better ratings ahead of him → rank. */
export function projectSlot(ctx: TeamContext, grp: FaPos, market: number): { slot: LineSlot; line: number } {
  const rank = 1 + ctx.markets[grp].filter((m) => m > market).length;
  const slot = slotForRank(grp, rank);
  return { slot, line: slotToLine(slot) };
}

/** A commissioner hand-set demand ladder (Admin → FA Tuning) is the player's price at each term —
 *  exactly the numbers Demand Watch shows. When one exists it IS what he asks at that term: no
 *  RFA discount, role or contention bend on top (a lowball insult to the club still raises it). */
function ladderOf(raw: unknown): Record<number, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<number, number> = {};
  for (const t of [1, 2, 3, 4]) {
    const v = (raw as Record<string, unknown>)[String(t)];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[t] = v;
  }
  return Object.keys(out).length ? out : null;
}

export type TeamAsk = {
  grp: FaPos; base: Demand; slot: LineSlot; line: number;
  contention: Contention; churn: number; desired: Desired; ask: Demand; age: number | null;
  lowballBump: number; // >1 when this club insulted him with a lowball earlier (his ask to THEM is up)
  elite: number; // elite-ladder price (0 = not elite)
  ladder: Record<number, number> | null; // commissioner hand-set price per term (Admin → FA Tuning / Demand Watch)
};

// ---- lowball memory --------------------------------------------------------
// A club that offers well under his floor insults the player: his ask TO THAT
// CLUB rises by the depth of the lowball (offer 18 % under → +18 %), compounding
// up to a cap, until he signs anywhere. Other clubs see his normal number.
const LOWBALL_MEMORY_DAYS = 200;

export async function lowballBump(playerId: number, teamId: number): Promise<number> {
  const row = await prisma.faLowball.findUnique({ where: { playerId_teamId: { playerId, teamId } } }).catch(() => null);
  if (!row || Date.now() - row.updatedAt.getTime() > LOWBALL_MEMORY_DAYS * 86400000) return 1;
  return row.bump;
}

/** How many times this club has already insulted him with a real lowball — 0 if
 *  never (or it's aged out). Once this reaches 2, he stops settling for his bare
 *  floor from this club: see the requireFullAsk check in extendContractAction. */
export async function lowballInsultCount(playerId: number, teamId: number): Promise<number> {
  const row = await prisma.faLowball.findUnique({ where: { playerId_teamId: { playerId, teamId } } }).catch(() => null);
  if (!row || Date.now() - row.updatedAt.getTime() > LOWBALL_MEMORY_DAYS * 86400000) return 0;
  return row.count;
}

/** Call AFTER judging an offer against the pre-offer ask (his headline ask AT THIS TERM,
 *  not the discounted floor — see lowballTier). Returns the new bump when this offer
 *  counted as a real insult, else null. */
export async function recordLowball(playerId: number, teamId: number, salary: number, ask: number): Promise<number | null> {
  if (!(ask > 0)) return null;
  const { maxUndershootPct, bumpAmount } = lowballTier(ask);
  if (salary >= ask * (1 - maxUndershootPct)) return null;
  const s = await loadSettings();
  const prev = await lowballBump(playerId, teamId);
  // The cap always leaves room for roughly TWO real insults before it clamps, whatever
  // tier he's in. A flat % cap would exhaust itself on a single cheap-contract insult
  // (bumpAmount is a bigger slice of a $1M ask than of a $10M one — ~50% in one shot
  // vs ~10%) while barely denting a star's. Never goes below the commissioner's own
  // floor (faLowballMaxBumpPct) — only raises it when one insult alone would need more.
  const perInsultPct = bumpAmount / ask;
  const capPct = Math.max(s.faLowballMaxBumpPct / 100, perInsultPct * 2);
  const bump = Math.min(1 + capPct, prev * (1 + perInsultPct));
  await prisma.faLowball.upsert({
    where: { playerId_teamId: { playerId, teamId } },
    create: { playerId, teamId, bump, count: 1 },
    update: { bump, count: { increment: 1 } },
  });
  return bump;
}

/** He signed — every club's slate is wiped clean. */
export async function clearLowballs(playerId: number): Promise<void> {
  await prisma.faLowball.deleteMany({ where: { playerId } }).catch(() => {});
}

export function lowballNote(bump: number): string | null {
  const pct = Math.round((bump - 1) * 100);
  return pct >= 1 ? `Insulted by your earlier lowball — asking your club ${pct}% more` : null;
}

/** An own-club RFA extension: no UFA market to test, only offer sheets — he signs
 *  for less than a UFA of the same rating would ask. */
const RFA_EXTENSION_FACTOR = 0.85;
/** Asks at or under this are short-term only (max 2 years). */
const CHEAP_DEAL_MAX = 1_500_000;

/** The Interest feedback: what the player would want to sign at THIS club, given
 *  the role he projects into there + whether the club is a contender. */
export async function teamAsk(playerId: number, teamId: number, pool?: MarketRow[], cmap?: Map<number, Contention>, round?: number, churnMap?: Map<number, number>): Promise<TeamAsk | null> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { ...SEL, age: true, faDemandOverride: true, faOverrideLadder: true, df: true, teamId: true, birthDate: true, contractYears: true, rightsReleased: true } });
  if (!p) return null;
  const marketPool = pool ?? (await loadMarketPool());
  const fullGP = await leagueFullGP();
  const rnd = round ?? (await currentFrenzyRound());
  const priorBidders = (await priorRoundBidderCounts([playerId], rnd)).get(playerId);
  const s = await loadSettings();
  const { grp, market } = playerMarket(p as PoolPlayer, { f: s.faWeightF, d: s.faWeightD, g: s.faWeightG });
  // A player re-signing with his OWN club is NOT stale on the open market — no season
  // decay. The "nobody's biting" softening only applies to unsigned market UFAs.
  const ownOrg = await prisma.team.findUnique({ where: { id: teamId }, select: { affiliateTeams: { select: { id: true } } } });
  const isOwn = p.teamId === teamId || !!ownOrg?.affiliateTeams.some((a) => a.id === p.teamId);
  // Own-club extension outside the Frenzy: he isn't testing the market, so no opening
  // premium — and an RFA (no UFA market, offer sheets only) has less leverage still.
  const clock = await getLeagueClock();
  const extension = isOwn && !clock.frenzyOpen;
  const rfa = extension && s.faMode !== "simple" && !ufaAtExpiry(p);
  // RFA leverage: a young RFA (no arbitration yet, ≤ 23 at expiry) has almost none;
  // an arbitration-eligible one (24-26) gets close to market (an arbitrator would).
  const expAge = p.birthDate ? ageAsOfJune30(p.birthDate, CURRENT_SEASON_START + Math.max(0, p.contractYears ?? 0)) : (p.age ?? 27);
  const rfaFactor = rfa ? (expAge <= 23 ? RFA_EXTENSION_FACTOR : 0.95) : 1;
  // the age that matters is his age when the NEW deal starts: an in-season extension
  // kicks in next season, so a 33-year-old is signing as a 34-year-old
  const dealAge = extension && (p.contractYears ?? 0) >= 1 && p.birthDate ? ageAsOfJune30(p.birthDate, CURRENT_SEASON_START + p.contractYears!) : p.age;
  // an RFA isn't testing the market ⇒ the middle of his peer group; a pending UFA
  // could walk to it, so he's priced like the market (upper part of the group)
  const rated = anchorFromPool(marketPool, grp, market, rfa ? 0.5 : undefined);
  const maxSalary = await maxContract();
  // the elite ladder prices today's player (Kucherov is still a $16M+ player now);
  // his decline over a longer deal is priced by the term (termPremium from dealAge)
  const elite = eliteTarget(p, grp, market, marketPool, maxSalary);
  const role = roleAnchor(p, grp, marketPool);
  const anchor = role != null ? (rated.anchor + role) / 2 : rated.anchor, count = rated.count;
  const rawBase = buildDemand({
    market, grp, age: dealAge, anchor, comps: count, override: p.faDemandOverride, capGrowth: 1, round: rnd, priorBidders,
    perf: performanceOf(p, grp, market, marketPool, { f: s.faWeightF, d: s.faWeightD, g: s.faWeightG }),
    availability: availabilityFactor(p.lastSeasonGP, fullGP, grp === "G"),
    eliteTarget: elite, maxSalary,
    downSeason: isDownSeason(p.lastSeasonGP, fullGP, grp === "G"), morale: p.morale, currentSalary: p.capHit, realCapHit: p.realCapHit,
    openingPremium: !extension, rfaFactor,
  });
  const unbumped = p.faDemandOverride != null ? rawBase : scaleDemand(rawBase, isOwn ? 1 : await faStaleFactor());
  const bump = await lowballBump(playerId, teamId);
  let base = bump > 1
    ? { ...unbumped, salary: Math.min(maxSalary, round50k(unbumped.salary * bump)), floorSalary: Math.min(maxSalary, round50k(unbumped.floorSalary * bump)) }
    : unbumped;

  const ctx0 = await loadTeamContext(teamId, cmap, churnMap);
  // staying put isn't "joining a rebuild" — no rebuild premium on his own club's extension
  // …and an elite player's price is his ladder spot, whoever he plays for
  const ctx = (extension && ctx0.contention === "rebuild") || elite > 0 ? { ...ctx0, contention: "middle" as Contention } : ctx0;
  const { slot, line } = projectSlot(ctx, grp, market);
  // a young depth player wants a 2-year bridge — prove himself, then cash in
  if ((p.age ?? 27) <= 25 && isDepthSlot(slot) && base.years > 2) base = { ...base, years: 2 };
  // his own club knows his role: a spare / bottom-pair / 4th-liner re-signs as one
  if (extension && p.faDemandOverride == null) {
    const rf = slot === "XD" || slot === "XF" ? 0.7 : slot === "P3" || slot === "L4" ? 0.88 : 1;
    if (rf < 1) base = { ...base, salary: Math.max(775_000, round50k(base.salary * rf)), floorSalary: Math.max(775_000, round50k(base.floorSalary * rf)) };
  }
  // a cheap deal (≤ $1.5M) is a short one: he won't lock in a low salary beyond 2 years
  if (base.floorSalary <= CHEAP_DEAL_MAX) base = { ...base, years: Math.min(base.years, 2), maxYears: Math.min(base.maxYears, 2), minYears: Math.min(base.minYears, 2) };
  const desired = desiredDeployment(grp, line, p.df, slot === "XD" || slot === "XF");
  // projected ask = the club gives him the role he projects into, plus the ST he wants
  const projDeploy: Deployment = { line, pp: desired.wantPP, pk: desired.wantPK };
  let ask = deploymentDemand(base, grp, projDeploy, desired, ctx.contention, dealAge, ctx.churn);
  // an elite player's projected price is his ladder spot — the small PP/PK bends would
  // otherwise shuffle the order (a PK-capable Makar dipping under Werenski)
  if (elite > 0) ask = { ...ask, salary: base.salary, floorSalary: base.floorSalary };
  // a 32+ vet re-signing without a big year: his current deal stays the ceiling even
  // after the role/contention bend (the base already respects it — see buildDemand)
  if (extension && p.faDemandOverride == null && elite === 0 && (dealAge ?? 27) >= 32 && (p.capHit ?? 0) > 0) {
    const avail = availabilityFactor(p.lastSeasonGP, await leagueFullGP(), grp === "G");
    const big = performanceOf(p, grp, market, marketPool, { f: s.faWeightF, d: s.faWeightD, g: s.faWeightG }) >= 1.08 && (dealAge ?? 27) < 35 && avail >= 0.95;
    const cap = round50k(p.capHit! * (big ? 1.1 : 1) * avail);
    if (ask.salary > cap) ask = { ...ask, salary: cap, floorSalary: Math.min(ask.floorSalary, round50k(cap * 0.92)) };
  }
  // a young RFA with no arbitration rights yet (≤ 23 at expiry) can't command the max —
  // his leverage tops out around 70 % of it (Celebrini-type second deals)
  // …unless he's one of the league's elite: then his ladder spot is the ceiling (Celebrini ≈ Carlsson)
  const ceiling = rfa && expAge <= 23 ? Math.max(round50k(maxSalary * 0.7), elite) : maxSalary;
  if (ask.salary > ceiling) ask = { ...ask, salary: ceiling, floorSalary: Math.min(ask.floorSalary, round50k(ceiling * 0.92)) };
  const ladder = ladderOf((p as { faOverrideLadder?: unknown }).faOverrideLadder);
  if (ladder && ladder[ask.years] != null) {
    const gap = ask.salary > 0 ? ask.floorSalary / ask.salary : 0.9;
    const sal = Math.min(maxSalary, round50k(ladder[ask.years] * bump));
    ask = { ...ask, salary: sal, floorSalary: Math.max(775_000, Math.min(sal, round50k(sal * gap))) };
  }
  return { grp, base, slot, line, contention: ctx.contention, churn: ctx.churn, desired, ask, age: dealAge, lowballBump: bump, elite, ladder };
}

/** Asks from this up ignore the promised role entirely (price = Demand Watch value). */
const ROLE_FREE_ASK = 6_000_000;

/** Evaluate a concrete offer (money + term + promised deployment) at a club. */
export async function evaluateTeamOffer(
  playerId: number, teamId: number, salary: number, years: number, deploy: Deployment,
  pool?: MarketRow[], cmap?: Map<number, Contention>, round?: number,
  grant?: { clause?: string | null; breadth?: number | null; ignoreRole?: boolean },
  churnMap?: Map<number, number>,
): Promise<{ acceptable: boolean; ask: Demand; utility: number; base: TeamAsk } | null> {
  const info = await teamAsk(playerId, teamId, pool, cmap, round, churnMap);
  if (!info) return null;
  // a lone two-way bidder in the in-season market: the role promised isn't part of the
  // deal, so judge it as exactly the role he projects into (no premium, no discount).
  // line 0 = "Automatic" — no promise: priced as the role he projects into (+ a small uncertainty premium below)
  const noPromise = deploy.line === 0 && !grant?.ignoreRole;
  if (grant?.ignoreRole || deploy.line === 0) deploy = { line: info.desired.line, pp: info.desired.wantPP, pk: info.desired.wantPK };
  let raw = deploymentDemand(info.base, info.grp, deploy, info.desired, info.contention, info.age, info.churn);
  // The price Demand Watch / the re-sign window show (info.ask) is already the price for the role and
  // special teams he projects into. Promising MORE than that (a bigger line, PP/PK he didn't ask for) must
  // not buy a discount below it — only the clause discount below may lower it. A WORSE role than he projects
  // still costs a premium on top (the max keeps it).
  // From ROLE_FREE_ASK up (stars) the role plays no part at all: the price IS the Demand Watch value,
  // a worse promised role doesn't raise it either.
  const roleFree = info.ask.salary >= ROLE_FREE_ASK;
  raw = roleFree
    ? { ...info.ask } // whole demand incl. term window — a worse promised role doesn't shorten it either
    : { ...raw, salary: Math.max(raw.salary, info.ask.salary), floorSalary: Math.max(raw.floorSalary, info.ask.floorSalary) };
  // granting a clause lets him sign for less — discount his floor + headline ask.
  // EXCEPT when the club promises him a worse role than he wants: then he wants to
  // be free to move on, so a no-trade clause is worth nothing to him.
  const roleWorse = !roleFree && deploy.line > info.desired.line;
  const disc = roleWorse ? 0 : clauseDiscount(grant?.clause, grant?.breadth);
  // longer term than his sweet spot raises the price (always negotiable, never a refusal)
  const tp = termPremium(years, raw.years, info.age, info.slot, raw.floorSalary, info.elite > 0);
  const f = (1 - disc) * tp * (noPromise && !roleFree && !info.ladder ? NO_PROMISE_PREMIUM : 1);
  let ask: Demand = f !== 1
    ? { ...raw, floorSalary: Math.max(775_000, Math.round((raw.floorSalary * f) / 50_000) * 50_000), salary: Math.max(775_000, Math.round((raw.salary * f) / 50_000) * 50_000) }
    : raw;
  // a hand-set ladder prices every term it covers directly (clause discounts still apply)
  if (info.ladder && info.ladder[years] != null) {
    const gap = raw.salary > 0 ? raw.floorSalary / raw.salary : 0.9;
    const sal = Math.max(775_000, round50k(info.ladder[years] * info.lowballBump * (1 - disc)));
    ask = { ...raw, salary: sal, floorSalary: Math.max(775_000, Math.min(sal, round50k(sal * gap))) };
  }
  const acceptable = offerAcceptable(ask, salary, years);
  const utility = offerUtility(salary, info.grp, deploy, info.desired, info.contention, info.age, info.churn) + disc * raw.salary;
  return { acceptable, ask, utility, base: info };
}

/** The `n` weakest NHL teams by ROSTER STRENGTH (excluding `exceptTeamId`) — the clubs a
 *  player most wants to avoid, used to fill an M-NTC no-trade list of a given breadth.
 *  Uses the same strength measure as the contender/rebuild split (mean OV of the top-18
 *  skaters), not the standings: after 2-3 games the table is pure noise and put clubs like
 *  EDM or TBL on a star's "won't go there" list. */
export async function weakestTeams(n: number, exceptTeamId: number): Promise<number[]> {
  const ranked = await rosterStrengthByTeam(); // strongest first
  return [...ranked].reverse().map((t) => t.id).filter((id) => id !== exceptTeamId).slice(0, n);
}

/** Batch-value a set of players (e.g. the whole free-agent board) against one pool. */
export async function demandForPlayers(
  players: Array<PoolPlayer & { id: number; age: number | null; faDemandOverride: number | null }>,
  pool?: MarketRow[],
): Promise<Map<number, DemandFor>> {
  const marketPool = pool ?? (await loadMarketPool());
  const fullGP = await leagueFullGP();
  const round = await currentFrenzyRound();
  const stale = await faStaleFactor();
  const priorBidders = await priorRoundBidderCounts(players.map((p) => p.id), round);
  const out = new Map<number, DemandFor>();
  const maxSalary = await maxContract();
  const weights = await loadFaWeights();
  for (const p of players) out.set(p.id, demandFromRow(p, marketPool, fullGP, round, stale, priorBidders.get(p.id), maxSalary, weights));
  return out;
}

// RFA cutoff age — matches submitOfferAction's own `(player.age ?? 27) >= 27` line
// exactly (the one place this threshold was previously hardcoded); a league running
// the "simple" faMode has no RFA restriction at all, everyone tests the open market.
const UFA_AGE = 27;

/** CBA status at the END of his current deal: UFA if he's 27 on June 30 of the year
 *  it expires (not his age today — Quinn Hughes is 26 now but 27 by June 30, 2027).
 *  An already-expired deal (0 years) is judged at the June 30 just passed. A club that
 *  has declared it won't re-sign an RFA (`rightsReleased` — real-NHL "not qualifying")
 *  treats him as a UFA regardless of age. */
export function ufaAtExpiry(p: { age: number | null; birthDate?: string | Date | null; contractYears?: number | null; rightsReleased?: boolean | null }): boolean {
  if (p.rightsReleased) return true;
  const expiry = CURRENT_SEASON_START + Math.max(0, p.contractYears ?? 0);
  if (p.birthDate) return ageAsOfJune30(p.birthDate, expiry) >= UFA_AGE;
  return (p.age ?? UFA_AGE) + Math.max(0, (p.contractYears ?? 0) - 1) >= UFA_AGE;
}

/** Every NHL/AHL player whose contract has run dry (0 years, not a $100k farm-filler
 *  placeholder) — split into UFA-age and RFA-age buckets by the same rule
 *  submitOfferAction uses. Shared by both sweep functions below so they always
 *  agree on exactly who's affected. */
async function expiredContractCandidates(): Promise<{ ufaIds: number[]; rfaIds: number[] }> {
  const { loadSettings } = await import("./sim/settings");
  // make sure the league year has rolled (deals expired, extensions started) first —
  // an expired deal with a signed extension waiting isn't free agency
  const { rollContractsIfDue, applyPendingExtensions } = await import("./contract-extensions");
  await rollContractsIfDue();
  await applyPendingExtensions();
  const [settings, candidates] = await Promise.all([
    loadSettings(),
    prisma.player.findMany({
      where: { rosterType: { in: ["NHL", "AHL"] }, contractYears: 0, NOT: { capHit: 100_000 } },
      select: { id: true, age: true, birthDate: true, contractYears: true, rightsReleased: true },
    }),
  ]);
  const isUfaAge = (p: { age: number | null; birthDate: string | Date | null; contractYears: number | null; rightsReleased: boolean }) => settings.faMode === "simple" || ufaAtExpiry(p);
  return {
    ufaIds: candidates.filter((p) => isUfaAge(p)).map((p) => p.id),
    rfaIds: candidates.filter((p) => !isUfaAge(p)).map((p) => p.id),
  };
}

/** A player whose contract has run out (0 years left) but who nobody re-signed
 *  stays parked on his old club's roster (rosterType NHL/AHL) until this runs —
 *  the market pages and Frenzy demand engine only ever look at rosterType: UFA,
 *  so without this he's simply invisible to every other GM, not just unsigned.
 *  UFA-age (or every player under "simple" faMode) only — an RFA-age player must
 *  NOT be dumped into the open UFA pool this way, since restricted free agency has
 *  its own structured tender/re-sign/offer-sheet flow (see submitOfferAction);
 *  he's left exactly where he is (see sweepUnsignedRfasToNonRoster for his own
 *  treatment). Excludes the $100k farm-filler placeholder contracts (ContractSection's
 *  own exclusion) — those aren't real deals a GM is expected to act on. Idempotent:
 *  safe to call from every point a market window opens (regular-season opening day,
 *  a Frenzy round starting — calendar-driven or admin-forced) since the rosterType
 *  filter naturally excludes anyone already swept. */
export async function sweepExpiredContractsToUfa(): Promise<number> {
  const { ufaIds } = await expiredContractCandidates();
  if (!ufaIds.length) return 0;
  const swept = await prisma.player.updateMany({ where: { id: { in: ufaIds } }, data: { rosterType: "UFA", scratched: false, captaincy: null } });
  return swept.count;
}

/** Regular-season opening day ONLY: an RFA-age player whose contract ran out and
 *  who his own club never re-signed (through the whole off-season + Frenzy) gets
 *  benched — rosterType "NONROSTER" — instead of becoming a plain open UFA. He
 *  stays owned by his club (ContractSection's re-sign query includes NONROSTER
 *  specifically so his own GM can still act on him), but no longer counts toward
 *  the legal 12F/6D/2G roster (autoFillRosters' count query only matches "NHL"/
 *  "AHL") and can never be selected into a game-day lineup (loadSimTeam's query is
 *  the same). The moment his own GM successfully extends him, extendContractAction
 *  restores rosterType to a real roster status and he's usable again. Deliberately
 *  NOT called at Frenzy-opening — an RFA stays normally negotiable by his own club
 *  all through the off-season/Frenzy; only unsigned regular-season opening day
 *  benches him. */
export async function sweepUnsignedRfasToNonRoster(): Promise<number> {
  const { rfaIds } = await expiredContractCandidates();
  if (!rfaIds.length) return 0;
  const swept = await prisma.player.updateMany({ where: { id: { in: rfaIds } }, data: { rosterType: "NONROSTER", scratched: false, captaincy: null } });
  return swept.count;
}
