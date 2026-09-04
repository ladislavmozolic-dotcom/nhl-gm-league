// Edge Parameters — ratings built from REAL NHL/AHL performance, relative to peers
// at the same position and league, on a per-60 basis. Pure: percentile → rating
// mapping + composite definitions. The server gathers the population and ranks.
//
// Principles (user spec): relative-to-NHL (not absolute thresholds), per-60 (not
// totals), composites with weights. 80% current real season + 20% prior.

export const CUR_W = 0.8;
export const LAST_W = 0.2;

/** Per-60 rate from a season total, TOI/game (seconds) and games played. */
export function per60(total: number, toiPerGameSec: number, gp: number): number {
  const minutes = (toiPerGameSec / 60) * gp;
  return minutes > 0 ? (total / minutes) * 60 : 0;
}

/** Blend a current-season and prior-season value 80/20 (skipping empty seasons). */
export function blend(cur: number | null | undefined, last: number | null | undefined): number {
  const c = cur ?? 0, l = last ?? 0;
  const hasC = cur != null && cur !== 0, hasL = last != null && last !== 0;
  if (hasC && hasL) return c * CUR_W + l * LAST_W;
  if (hasC) return c;
  if (hasL) return l;
  return 0;
}

// Non-linear percentile→rating curves — a percentile is only a MID-STEP; how rare
// 90/95/99 should be is set here per parameter (configurable anchor points), so
// the database doesn't fill with inflated elites. SC is deliberately scarce
// (90+ ≈ top 7%, 98-99 truly exceptional); PA a touch looser; others use DEFAULT.
export type Anchor = [p: number, r: number]; // percentile 0..1 → rating
const ends = (a: Anchor[]): Anchor[] => [[0, 50], ...a, [1, 99]];
export const RATING_CURVES: Record<string, Anchor[]> = {
  SC: ends([[0.10, 58], [0.25, 66], [0.50, 74], [0.70, 80], [0.85, 86], [0.93, 90], [0.97, 94], [0.99, 97], [0.997, 99]]),
  PA: ends([[0.10, 58], [0.25, 66], [0.50, 74], [0.70, 80], [0.84, 86], [0.91, 90], [0.96, 94], [0.99, 97], [0.997, 99]]),
  DEFAULT: ends([[0.10, 59], [0.25, 67], [0.50, 74], [0.70, 80], [0.85, 85], [0.93, 89], [0.97, 92], [0.99, 95], [0.997, 98]]),
};

/** Map a percentile (0..1) to a rating via the parameter's non-linear anchor curve. */
export function ratingFromCurve(p: number, param = "DEFAULT"): number {
  const a = RATING_CURVES[param] ?? RATING_CURVES.DEFAULT;
  const x = clamp(p, 0, 1);
  for (let i = 1; i < a.length; i++) {
    if (x <= a[i][0]) {
      const [p0, r0] = a[i - 1], [p1, r1] = a[i];
      const t = p1 > p0 ? (x - p0) / (p1 - p0) : 0;
      return Math.round(r0 + t * (r1 - r0));
    }
  }
  return a[a.length - 1][1];
}

/** Rating bands for the distribution report / mental model. */
export const RATING_BANDS: { label: string; min: number; max: number }[] = [
  { label: "99", min: 99, max: 99 },
  { label: "95–98", min: 95, max: 98 },
  { label: "90–94", min: 90, max: 94 },
  { label: "85–89", min: 85, max: 89 },
  { label: "80–84", min: 80, max: 84 },
  { label: "70–79", min: 70, max: 79 },
  { label: "<70", min: 0, max: 69 },
];

/** Percentile (0..1) of `value` within a sorted-ascending population. */
export function percentileOf(value: number, sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0.5;
  let below = 0;
  for (const v of sortedAsc) { if (v < value) below++; else break; }
  // fraction strictly below + half the ties → stable mid-rank percentile
  let ties = 0;
  for (const v of sortedAsc) if (v === value) ties++;
  return (below + ties / 2) / sortedAsc.length;
}

// Composite definitions: each Edge parameter is a weighted average of sub-metric
// PERCENTILES (so different-scale rates combine cleanly). `invert` flags a metric
// where lower is better (e.g. penalties for Discipline). Metric keys are produced
// by the server per player.
export type Metric = { key: string; weight: number; invert?: boolean };
export const EDGE_COMPOSITES: Record<string, Metric[]> = {
  // scoring — an offensive-THREAT rating (matches how STHS "SC" reads): per-game goal
  // production leads, plus a slice of playmaking so two-way offensive stars (McDavid:
  // 48G but 90A) aren't buried under pure snipers; per-60 keeps the efficiency check.
  // scoring (Next Gen spec) — goals/60 in all situations + goals above expected
  // (G-xG, per-60), even weight. Volume + finishing skill, no stat double-counted.
  // g60 is the existing box-score rate (broad coverage); gxg60 needs MoneyPuck xG
  // and is simply skipped for the rare player without it.
  SC: [{ key: "g60", weight: 0.5 }, { key: "gxg60", weight: 0.5 }],
  // passing (Next Gen spec) — assists/60 in all situations + assists/60 at 5-on-5,
  // even weight. All-situations captures PP playmaking too; the 5v5 split isolates
  // even-strength distributing so a QB-of-the-PP alone doesn't inflate the rating.
  // a60 is the existing box-score rate (broad coverage); a605v5 needs MoneyPuck's
  // situational split and is simply skipped for the rare player without it.
  PA: [{ key: "a60", weight: 0.5 }, { key: "a605v5", weight: 0.5 }],
  // checking — hits per 60
  CK: [{ key: "hit60", weight: 1.0 }],
  // defense (Next Gen spec) — six-way blend: TRUE relative xGA/GA at 5v5 (on-ice
  // rate minus the rate the rest of the roster allows with this player OFF the ice,
  // from MoneyPuck's team + player CSVs) carries most of the weight, relative
  // shorthanded xGA adds context, plain (non-relative) on-ice xGA/GA at 5v5 anchor
  // it to an absolute level, and blocks/60 (all situations, box score) round it out.
  // All the against/allowed metrics are inverted (fewer goals/expected goals while
  // you're on the ice is better); blocks is not (more is better).
  DF: [
    { key: "relxga5v5", weight: 0.40, invert: true },
    { key: "relga5v5", weight: 0.15, invert: true },
    { key: "relxgapk", weight: 0.15, invert: true },
    { key: "axga5v5", weight: 0.20, invert: true },
    { key: "aga5v5", weight: 0.07, invert: true },
    { key: "blk60", weight: 0.03 },
  ],
  // endurance — ice time per game
  EN: [{ key: "toi", weight: 1.0 }],
  // faceoffs — win % (sample-adjusted by the server)
  FO: [{ key: "fo", weight: 1.0 }],
  // discipline — inverse of penalties per 60
  DI: [{ key: "pim60", weight: 1.0, invert: true }],
  // strength (Next Gen spec) — body weight, full stop.
  ST: [{ key: "wt", weight: 1.0 }],
  // puck handling — creation + takeaways, penalised for giveaways (entry/carry
  // tracking not in the feed yet, so this is a possession-events proxy)
  PH: [{ key: "off60", weight: 0.5 }, { key: "tk60", weight: 0.2 }, { key: "gv60", weight: 0.3, invert: true }],
  // fighting — penalty-minute load + physical engagement (no fighting-major feed, so
  // PIM/hits stand in: enforcers accrue both)
  FG: [{ key: "pim60", weight: 0.6 }, { key: "hit60", weight: 0.4 }],
  // penalty shot / breakaway — finishing skill + offensive touch (shootout/breakaway
  // conversion tracks finishers)
  PS: [{ key: "shpct", weight: 0.5 }, { key: "off60", weight: 0.3 }, { key: "g60", weight: 0.2 }],
  // skating (Next Gen spec) — real NHL EDGE speed-burst count (20+ mph), full stop.
  // NHL EDGE only publishes ONE burst threshold publicly (burstsOver20) — no 18+/22+
  // breakdown exists to split by, despite that being the original ask. metricsFor()
  // still falls back to ice-time for the handful of skaters missing EDGE data.
  SK: [{ key: "brst20", weight: 1.0 }],
  // experience (Next Gen spec) — career games played, regular season + playoffs.
  EX: [{ key: "regGP", weight: 0.7 }, { key: "poGP", weight: 0.3 }],
};

/** EX fallback — an absolute age curve, used only when a player has no imported
 *  careerGP data at all (see EDGE_COMPOSITES.EX / EDGE_GOALIE_COMPOSITES.EX for the
 *  primary Next Gen formula: career regular-season + playoff games played).
 *  1000-game vet ≈ 95+, rookie ≈ 50-60. */
export function experienceFromAge(age: number | null | undefined): number {
  const a = age ?? 24;
  if (a <= 20) return 52;
  if (a >= 35) return 95;
  return Math.round(52 + ((a - 20) / 15) * 43); // 20→52 … 35→95
}

/** DU — durability from availability (games played / possible), blended 80/20.
 *  Kept off the floor so one lost season doesn't zero it. */
export function durabilityFromAvailability(curGP: number, curPossible: number, lastGP: number): number {
  const lastAvail = clamp(lastGP / 82, 0, 1);
  const curAvail = curPossible > 0 ? clamp(curGP / curPossible, 0, 1) : lastAvail;
  const avail = curPossible >= 20 ? curAvail * CUR_W + lastAvail * LAST_W : lastAvail;
  return Math.round(clamp(55 + avail * 44, 45, 99));
}

/** LD — leadership from captaincy + experience (commissioner may override). */
export function leadershipFrom(captaincy: string | null | undefined, ex: number): number {
  const base = captaincy === "C" ? 86 : captaincy === "A" ? 78 : 68;
  return Math.round(clamp(base + (ex - 70) * 0.2, 50, 99));
}

export const EDGE_MO_DEFAULT = 50; // morale starts at league default, then our universe moves it

// Goalie composites (MoneyPuck-driven). The danger splits let the primary abilities
// (SC / RT / HS / AG) genuinely differ instead of all tracking overall SV%.
export const EDGE_GOALIE_COMPOSITES: Record<string, Metric[]> = {
  // style control — positioning & consistency: low/med-danger stops + overall GSAx
  SC: [{ key: "ldSv", weight: 0.4 }, { key: "mdSv", weight: 0.35 }, { key: "gsax60", weight: 0.25 }],
  // reaction time — high-danger stops + goals saved above expected on them
  RT: [{ key: "hdSv", weight: 0.6 }, { key: "hdGsax", weight: 0.4 }],
  // hand speed — quick stops across the board, high-danger leaning
  HS: [{ key: "hdSv", weight: 0.5 }, { key: "gsax60", weight: 0.5 }],
  // agility — lateral / mid-range coverage
  AG: [{ key: "mdSv", weight: 0.5 }, { key: "hdSv", weight: 0.5 }],
  // rebound control — allowing fewer rebounds than expected
  RB: [{ key: "rebCtrl", weight: 1.0 }],
  // endurance — starter workload (ice time)
  EN: [{ key: "icetime", weight: 1.0 }],
  // size
  SZ: [{ key: "sz", weight: 1.0 }],
  // experience (Next Gen spec) — career games played, regular season + playoffs.
  EX: [{ key: "regGP", weight: 0.7 }, { key: "poGP", weight: 0.3 }],
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
