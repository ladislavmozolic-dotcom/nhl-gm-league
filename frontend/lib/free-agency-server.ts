// Server-side glue for the Free Agent Frenzy engine: builds the "market" from
// every signed contract, then values free agents / re-sign candidates against it.

import { prisma } from "./prisma";
import { loadSettings } from "./sim/settings";
import { getLeagueClock } from "./calendar-server";
import { computeStandings } from "./sim/standings";
import { CURRENT_SEASON_START, ageAsOfJune30 } from "./finance";
import {
  faPosGroup, skaterMarket, goalieMarket, anchorFromPool, buildDemand, percentile, availabilityFactor, isDepthSlot, eliteFactor,
  slotForRank, slotToLine, desiredDeployment, deploymentDemand, offerUtility, offerAcceptable, clauseDiscount, termPremium,
  type MarketRow, type Demand, type FaPos, type Contention, type Deployment, type Desired, type LineSlot,
} from "./free-agency";

/** Current weekly negotiation round (1..3); 1 = opening ask outside the window. */
export async function currentFrenzyRound(): Promise<number> {
  return (await getLeagueClock()).frenzyRound || 1;
}

/** CBA max contract: 20 % of the league's upper cap. */
export async function maxContract(): Promise<number> {
  return Math.round(((await loadLeagueCap()).upper * 0.2) / 50_000) * 50_000;
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
  goalieRating: { select: { ag: true, rb: true, sc: true, hs: true } },
} as const;

/** The "full slate" games played this season (p85 of everyone with a value) — a
 *  player who played well under this missed real time (injury/down year). */
export async function leagueFullGP(): Promise<number> {
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

/** Sim-weighted market rating for any player row (skater attrs or goalie card). */
export function playerMarket(p: PoolPlayer): { grp: FaPos; market: number } {
  const grp = faPosGroup(p.position, p.isGoalie);
  if (grp === "G") return { grp, market: goalieMarket(p.goalieRating ?? {}) };
  return { grp, market: skaterMarket(p, grp) };
}

/** Every signed contract becomes one comparable row. */
export async function loadMarketPool(): Promise<MarketRow[]> {
  const signed = await prisma.player.findMany({
    where: { rosterType: { in: ["NHL", "AHL"] }, capHit: { gt: 0 }, contractYears: { gt: 0 } },
    select: SEL,
  });
  return signed.map((p) => {
    const { grp, market } = playerMarket(p as PoolPlayer);
    const ppg = grp !== "G" && (p.lastSeasonGP ?? 0) >= 20 ? (p.lastSeasonPts ?? 0) / p.lastSeasonGP! : null;
    const toi = grp !== "G" && (p.lastSeasonGP ?? 0) >= 20 && (p.lastSeasonToi ?? 0) > 0 ? p.lastSeasonToi : null;
    return { grp, market, capHit: p.capHit ?? 0, ppg, toi, age: p.age };
  });
}

/** eliteFactor inputs for one player: rating rank + production rank in his group. */
export function eliteOf(
  p: { lastSeasonGP?: number | null; lastSeasonPts?: number | null; age?: number | null },
  grp: FaPos, market: number, pool: MarketRow[],
): number {
  const same = pool.filter((r) => r.grp === grp);
  if (same.length < 20) return 1;
  const ratingPct = same.filter((r) => r.market < market).length / same.length;
  let prodPct: number | null = null;
  if (grp !== "G" && (p.lastSeasonGP ?? 0) >= 40) {
    const ppg = (p.lastSeasonPts ?? 0) / p.lastSeasonGP!;
    const prod = same.filter((r) => r.ppg != null);
    if (prod.length >= 20) prodPct = prod.filter((r) => r.ppg! < ppg).length / prod.length;
  }
  return eliteFactor(ratingPct, prodPct, p.age, grp === "G");
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

/** Last season's production vs. players rated like him → the demand's performance
 *  multiplier (1 = produced like his rating says). Skaters: points/GP against the
 *  same-rating comps (a D's points count less — his job isn't scoring). Goalies:
 *  save % against a league-average .903. No real sample → neutral. */
export function performanceOf(
  p: { lastSeasonGP?: number | null; lastSeasonPts?: number | null; lastSeasonSvPct?: number | null; lastSeasonToi?: number | null },
  grp: FaPos, market: number, pool: MarketRow[],
): number {
  const gp = p.lastSeasonGP ?? 0;
  if (grp === "G") {
    const sv = p.lastSeasonSvPct;
    if (gp < 15 || sv == null || !(sv > 0.8)) return 1;
    return Math.max(0.85, Math.min(1.15, 1 + (sv - 0.903) * 8));
  }
  if (gp < 20) return 1;
  const comps = pool.filter((r) => r.grp === grp && r.ppg != null && Math.abs(r.market - market) <= 3);
  if (comps.length < 8) return 1;
  const exp = comps.reduce((t, r) => t + r.ppg!, 0) / comps.length;
  if (!(exp > 0.05)) return 1;
  const ratio = ((p.lastSeasonPts ?? 0) / gp) / exp;
  let f = 1 + (ratio - 1) * (grp === "D" ? 0.25 : 0.45);
  // a D is paid for his minutes as much as his points — bottom-pair TOI ⇒ bottom-pair money
  const toiComps = comps.filter((r) => r.toi != null);
  if (grp === "D" && (p.lastSeasonToi ?? 0) > 0 && toiComps.length >= 8) {
    const expToi = toiComps.reduce((t, r) => t + r.toi!, 0) / toiComps.length;
    f *= 1 + (p.lastSeasonToi! / expToi - 1) * 1.2;
  }
  return Math.max(0.8, Math.min(1.2, f));
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
  return demandFromRow(p as PoolPlayer & { id: number; age: number | null; faDemandOverride: number | null }, marketPool, fullGP, round, stale, priorBidders, await maxContract());
}

function demandFromRow(
  p: PoolPlayer & { id: number; age: number | null; faDemandOverride: number | null },
  pool: MarketRow[], fullGP: number, round: number, stale = 1, priorBidders?: number, maxSalary = 16_000_000,
): DemandFor {
  const { grp, market } = playerMarket(p);
  const rated = anchorFromPool(pool, grp, market);
  const role = roleAnchor(p, grp, pool);
  const anchor = role != null ? (rated.anchor + role) / 2 : rated.anchor, count = rated.count;
  const demand = buildDemand({
    market, grp, age: p.age, anchor, comps: count,
    override: p.faDemandOverride, capGrowth: 1, round, priorBidders, perf: performanceOf(p, grp, market, pool),
    availability: availabilityFactor(p.lastSeasonGP, fullGP, grp === "G"),
    elite: eliteOf(p, grp, market, pool), maxSalary,
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

/** Contender / middle / rebuild / rising for every NHL team. The base split is
 *  from CURRENT roster strength (mean OV of the top-18 skaters), thirds — same
 *  as before. The bottom third (the "rebuild" tier) is then split again by
 *  teamOutlookScores: the half of it with a real near-term window (prospects +
 *  picks + a young core) becomes "rising" instead of a plain "rebuild", so a
 *  young/unhappy free agent can weigh a genuine rebuild timeline against just
 *  chasing whichever club is best today (see contentionModifier/Bonus). */
export async function teamContentionMap(): Promise<Map<number, Contention>> {
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
  const strength = [...byTeam.entries()].map(([id, e]) => {
    const top = [...e.ov].sort((a, b) => b - a).slice(0, 18);
    const avgAge = e.age.length ? e.age.reduce((a, b) => a + b, 0) / e.age.length : 27;
    return { id, s: top.reduce((x, y) => x + y, 0) / Math.max(1, top.length), avgAge };
  }).sort((a, b) => b.s - a.s);
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

export type TeamContext = { contention: Contention; markets: Record<FaPos, number[]> };

export async function loadTeamContext(teamId: number, cmap?: Map<number, Contention>): Promise<TeamContext> {
  const roster = await prisma.player.findMany({ where: { teamId, rosterType: "NHL" }, select: SEL });
  const markets: Record<FaPos, number[]> = { F: [], D: [], G: [] };
  for (const p of roster) {
    const { grp, market } = playerMarket(p as PoolPlayer);
    markets[grp].push(market);
  }
  (Object.keys(markets) as FaPos[]).forEach((k) => markets[k].sort((a, b) => b - a));
  const contentionMap = cmap ?? (await teamContentionMap());
  return { contention: contentionMap.get(teamId) ?? "middle", markets };
}

/** Where the player slots on this club: strictly better ratings ahead of him → rank. */
export function projectSlot(ctx: TeamContext, grp: FaPos, market: number): { slot: LineSlot; line: number } {
  const rank = 1 + ctx.markets[grp].filter((m) => m > market).length;
  const slot = slotForRank(grp, rank);
  return { slot, line: slotToLine(slot) };
}

export type TeamAsk = {
  grp: FaPos; base: Demand; slot: LineSlot; line: number;
  contention: Contention; desired: Desired; ask: Demand; age: number | null;
  lowballBump: number; // >1 when this club insulted him with a lowball earlier (his ask to THEM is up)
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

/** Call AFTER judging an offer against the pre-offer ask. Returns the new bump
 *  when this offer counted as a lowball, else null. */
export async function recordLowball(playerId: number, teamId: number, salary: number, floor: number): Promise<number | null> {
  const s = await loadSettings();
  if (!(floor > 0) || salary >= floor * (s.faLowballPct / 100)) return null;
  const depth = 1 - salary / floor;
  const prev = await lowballBump(playerId, teamId);
  const bump = Math.min(1 + s.faLowballMaxBumpPct / 100, prev * (1 + depth));
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

/** The Interest feedback: what the player would want to sign at THIS club, given
 *  the role he projects into there + whether the club is a contender. */
export async function teamAsk(playerId: number, teamId: number, pool?: MarketRow[], cmap?: Map<number, Contention>, round?: number): Promise<TeamAsk | null> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { ...SEL, age: true, faDemandOverride: true, df: true, teamId: true, birthDate: true, contractYears: true } });
  if (!p) return null;
  const marketPool = pool ?? (await loadMarketPool());
  const fullGP = await leagueFullGP();
  const rnd = round ?? (await currentFrenzyRound());
  const priorBidders = (await priorRoundBidderCounts([playerId], rnd)).get(playerId);
  const { grp, market } = playerMarket(p as PoolPlayer);
  // A player re-signing with his OWN club is NOT stale on the open market — no season
  // decay. The "nobody's biting" softening only applies to unsigned market UFAs.
  const ownOrg = await prisma.team.findUnique({ where: { id: teamId }, select: { affiliateTeams: { select: { id: true } } } });
  const isOwn = p.teamId === teamId || !!ownOrg?.affiliateTeams.some((a) => a.id === p.teamId);
  // Own-club extension outside the Frenzy: he isn't testing the market, so no opening
  // premium — and an RFA (no UFA market, offer sheets only) has less leverage still.
  const clock = await getLeagueClock();
  const extension = isOwn && !clock.frenzyOpen;
  const s = await loadSettings();
  const rfa = extension && s.faMode !== "simple" && !ufaAtExpiry(p);
  // RFA leverage: a young RFA (no arbitration yet, ≤ 23 at expiry) has almost none;
  // an arbitration-eligible one (24-26) gets close to market (an arbitrator would).
  const expAge = p.birthDate ? ageAsOfJune30(p.birthDate, CURRENT_SEASON_START + Math.max(0, p.contractYears ?? 0)) : (p.age ?? 27);
  const rfaFactor = rfa ? (expAge <= 23 ? RFA_EXTENSION_FACTOR : 0.95) : 1;
  // an RFA isn't testing the market ⇒ the middle of his peer group; a pending UFA
  // could walk to it, so he's priced like the market (upper part of the group)
  const rated = anchorFromPool(marketPool, grp, market, rfa ? 0.5 : undefined);
  const elite = eliteOf(p, grp, market, marketPool);
  const maxSalary = await maxContract();
  const role = roleAnchor(p, grp, marketPool);
  const anchor = role != null ? (rated.anchor + role) / 2 : rated.anchor, count = rated.count;
  const rawBase = buildDemand({
    market, grp, age: p.age, anchor, comps: count, override: p.faDemandOverride, capGrowth: 1, round: rnd, priorBidders,
    perf: performanceOf(p, grp, market, marketPool),
    availability: availabilityFactor(p.lastSeasonGP, fullGP, grp === "G"),
    elite, maxSalary,
    downSeason: isDownSeason(p.lastSeasonGP, fullGP, grp === "G"), morale: p.morale, currentSalary: p.capHit, realCapHit: p.realCapHit,
    openingPremium: !extension, rfaFactor,
  });
  const unbumped = p.faDemandOverride != null ? rawBase : scaleDemand(rawBase, isOwn ? 1 : await faStaleFactor());
  const bump = await lowballBump(playerId, teamId);
  let base = bump > 1
    ? { ...unbumped, salary: Math.min(maxSalary, round50k(unbumped.salary * bump)), floorSalary: Math.min(maxSalary, round50k(unbumped.floorSalary * bump)) }
    : unbumped;

  const ctx0 = await loadTeamContext(teamId, cmap);
  // staying put isn't "joining a rebuild" — no rebuild premium on his own club's extension
  const ctx = extension && ctx0.contention === "rebuild" ? { ...ctx0, contention: "middle" as Contention } : ctx0;
  const { slot, line } = projectSlot(ctx, grp, market);
  // a young depth player wants a 2-year bridge — prove himself, then cash in
  if ((p.age ?? 27) <= 25 && isDepthSlot(slot) && base.years > 2) base = { ...base, years: 2 };
  // his own club knows his role: a spare / bottom-pair / 4th-liner re-signs as one
  if (extension && p.faDemandOverride == null) {
    const rf = slot === "XD" || slot === "XF" ? 0.7 : slot === "P3" || slot === "L4" ? 0.88 : 1;
    if (rf < 1) base = { ...base, salary: Math.max(775_000, round50k(base.salary * rf)), floorSalary: Math.max(775_000, round50k(base.floorSalary * rf)) };
  }
  const desired = desiredDeployment(grp, line, p.df, slot === "XD" || slot === "XF");
  // projected ask = the club gives him the role he projects into, plus the ST he wants
  const projDeploy: Deployment = { line, pp: desired.wantPP, pk: desired.wantPK };
  let ask = deploymentDemand(base, grp, projDeploy, desired, ctx.contention, p.age);
  // a 32+ vet re-signing without a big year: his current deal stays the ceiling even
  // after the role/contention bend (the base already respects it — see buildDemand)
  if (extension && p.faDemandOverride == null && elite < 1.15 && (p.age ?? 27) >= 32 && (p.capHit ?? 0) > 0) {
    const avail = availabilityFactor(p.lastSeasonGP, await leagueFullGP(), grp === "G");
    const big = performanceOf(p, grp, market, marketPool) >= 1.08 && (p.age ?? 27) < 35 && avail >= 0.95;
    const cap = round50k(p.capHit! * (big ? 1.1 : 1) * avail);
    if (ask.salary > cap) ask = { ...ask, salary: cap, floorSalary: Math.min(ask.floorSalary, round50k(cap * 0.92)) };
  }
  // a young RFA with no arbitration rights yet (≤ 23 at expiry) can't command the max —
  // his leverage tops out around 70 % of it (Celebrini-type second deals)
  const ceiling = rfa && expAge <= 23 ? round50k(maxSalary * 0.7) : maxSalary;
  if (ask.salary > ceiling) ask = { ...ask, salary: ceiling, floorSalary: Math.min(ask.floorSalary, round50k(ceiling * 0.92)) };
  return { grp, base, slot, line, contention: ctx.contention, desired, ask, age: p.age, lowballBump: bump };
}

/** Evaluate a concrete offer (money + term + promised deployment) at a club. */
export async function evaluateTeamOffer(
  playerId: number, teamId: number, salary: number, years: number, deploy: Deployment,
  pool?: MarketRow[], cmap?: Map<number, Contention>, round?: number,
  grant?: { clause?: string | null; breadth?: number | null },
): Promise<{ acceptable: boolean; ask: Demand; utility: number; base: TeamAsk } | null> {
  const info = await teamAsk(playerId, teamId, pool, cmap, round);
  if (!info) return null;
  const raw = deploymentDemand(info.base, info.grp, deploy, info.desired, info.contention, info.age);
  // granting a clause lets him sign for less — discount his floor + headline ask.
  // EXCEPT when the club promises him a worse role than he wants: then he wants to
  // be free to move on, so a no-trade clause is worth nothing to him.
  const roleWorse = deploy.line > info.desired.line;
  const disc = roleWorse ? 0 : clauseDiscount(grant?.clause, grant?.breadth);
  // longer term than his sweet spot raises the price (always negotiable, never a refusal)
  const tp = termPremium(years, raw.years, info.age, info.slot, raw.floorSalary);
  const f = (1 - disc) * tp;
  const ask: Demand = f !== 1
    ? { ...raw, floorSalary: Math.round((raw.floorSalary * f) / 50_000) * 50_000, salary: Math.round((raw.salary * f) / 50_000) * 50_000 }
    : raw;
  const acceptable = offerAcceptable(ask, salary, years);
  const utility = offerUtility(salary, info.grp, deploy, info.desired, info.contention, info.age) + disc * raw.salary;
  return { acceptable, ask, utility, base: info };
}

/** The `n` weakest NHL teams by standings (excluding `exceptTeamId`) — the clubs a
 *  player most wants to avoid, used to fill an M-NTC no-trade list of a given breadth. */
export async function weakestTeams(n: number, exceptTeamId: number): Promise<number[]> {
  const standings = await computeStandings();
  return [...standings].reverse().map((s) => s.teamId).filter((id) => id !== exceptTeamId).slice(0, n);
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
  for (const p of players) out.set(p.id, demandFromRow(p, marketPool, fullGP, round, stale, priorBidders.get(p.id), maxSalary));
  return out;
}

// RFA cutoff age — matches submitOfferAction's own `(player.age ?? 27) >= 27` line
// exactly (the one place this threshold was previously hardcoded); a league running
// the "simple" faMode has no RFA restriction at all, everyone tests the open market.
const UFA_AGE = 27;

/** CBA status at the END of his current deal: UFA if he's 27 on June 30 of the year
 *  it expires (not his age today — Quinn Hughes is 26 now but 27 by June 30, 2027).
 *  An already-expired deal (0 years) is judged at the June 30 just passed. */
export function ufaAtExpiry(p: { age: number | null; birthDate?: string | Date | null; contractYears?: number | null }): boolean {
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
      select: { id: true, age: true, birthDate: true, contractYears: true },
    }),
  ]);
  const isUfaAge = (p: { age: number | null; birthDate: string | Date | null; contractYears: number | null }) => settings.faMode === "simple" || ufaAtExpiry(p);
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
