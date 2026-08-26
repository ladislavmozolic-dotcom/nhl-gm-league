// EdgeNHL Rating Engine 2.0 — input & output schemas.
//
// The engine never talks to MoneyPuck / NHL EDGE / the NHL API directly. It consumes
// this NORMALIZED shape, so a loader (MoneyPuck skaters CSV, EDGE export, injury feed,
// AHL export) only has to MAP its columns onto these fields. That keeps the rating math
// independent of any one data source's quirks and column names.
//
// All rate stats are expressed as raw counts + ice time so the engine can build proper
// per-60 rates and TOI-weight them across seasons itself (see weighting.ts). Feed COUNTS,
// not pre-divided rates, wherever possible.

export type Pos = "C" | "LW" | "RW" | "D" | "G";
/** Comparison bucket used by percentile curves. F = all forwards, D = defense. */
export type Group = "F" | "D";

export const isForward = (p: Pos): boolean => p === "C" || p === "LW" || p === "RW";
export const groupOf = (p: Pos): Group => (isForward(p) ? "F" : "D");

/** One situation split (5v5 / PP / PK / all). icetime is in SECONDS (MoneyPuck native). */
export interface SituationLine {
  icetime: number; // seconds on ice in this situation
  goals?: number;
  xGoals?: number; // individual expected goals (I_F_xGoals)
  shotsOnGoal?: number;
  primaryAssists?: number;
  secondaryAssists?: number;
  hits?: number;
  giveaways?: number;
  dzGiveaways?: number; // defensive-zone giveaways
  takeaways?: number;
  blocks?: number; // shots blocked BY this player
  minorsTaken?: number; // minor penalties the player took
  majorsTaken?: number; // non-fighting majors + misconducts
  penaltiesDrawn?: number;
  faceoffsWon?: number;
  faceoffsLost?: number;
  rushAttempts?: number; // rush involvement (I_F_rush* proxy)
  // ON-ICE, already expressed relative to team-mean (team on/off). Inverse handled by engine.
  xGA60Rel?: number; // 5v5 xGA/60 relative to team (lower = better)
  hdXGA60Rel?: number; // high-danger xGA/60 relative
  CA60Rel?: number; // Corsi-against/60 relative
}

/** One real NHL season for one player. */
export interface SeasonStats {
  season: string; // "2025-26"
  gamesPlayed: number;
  all?: SituationLine; // all-situations aggregate
  ev5v5?: SituationLine; // 5v5
  pp?: SituationLine; // 5v4 power play
  pk?: SituationLine; // 4v5 penalty kill
  fights?: number; // fighting majors (own column, not part of DI)
}

/** NHL EDGE tracking (available NHL-wide from 2021-22). Optional per player. */
export interface EdgeData {
  season?: string;
  maxSpeedMph?: number; // top skating speed
  bursts20?: number; // number of 20+ mph bursts (season)
  bursts22?: number; // number of 22+ mph bursts (season)
  skatingMiles?: number; // total skating distance (miles)
  shotSpeedMph?: number; // hardest / avg shot speed — used as a strength/explosiveness proxy
}

export interface InjurySeason {
  season: string;
  gamesMissedInjury: number; // games missed specifically to injury (not scratch/AHL/demotion)
  eligibleGames: number; // team games he was under contract & healthy-eligible for (usually 82)
  longTermEvents?: number; // count of LTIR-length (multi-week) injuries this season
}

/** Career + identity fields that barely move season-to-season. */
export interface CareerData {
  careerNhlGP: number;
  careerPlayoffGP: number;
  nhlSeasons: number; // seasons since debut
  shootoutGoals?: number; // career shootout goals
  shootoutAttempts?: number; // career shootout attempts
  // Captaincy over the last 3-5 years, most recent first: "C" | "A" | null per season.
  captaincyHistory?: (("C" | "A") | null)[];
}

/** AHL production — translated to NHL-equivalent before rating (see leagueEq.ts). */
export interface AhlSeasonStats {
  season: string;
  gamesPlayed: number;
  icetime?: number; // seconds, if known
  goals?: number;
  primaryAssists?: number;
  secondaryAssists?: number;
  shotsOnGoal?: number;
  hits?: number;
  faceoffsWon?: number;
  faceoffsLost?: number;
}

export interface PlayerBio {
  id: string; // stable id (nhlId or slug)
  name: string;
  pos: Pos;
  age: number;
  heightCm?: number;
  weightKg?: number;
  isAhl?: boolean; // true → route through the AHL translation engine
}

/** Everything the engine needs about one player. */
export interface PlayerInput {
  bio: PlayerBio;
  seasons: SeasonStats[]; // most recent first; 1-3 NHL seasons
  edge?: EdgeData;
  injuries?: InjurySeason[];
  career?: CareerData;
  ahl?: AhlSeasonStats[]; // for AHL players (bio.isAhl)
  /** Optional manual scouting nudges, applied last: { PH: +3, ... }. Also carries reasons. */
  overrides?: Partial<Record<RatingKey, number>>;
  overrideReasons?: Partial<Record<RatingKey, string>>;
  /** Optional previous-cycle final ratings, for QA diffing + DU inter-year clamp. */
  previous?: Partial<Record<RatingKey, number>>;
}

export const RATING_KEYS = [
  "CK", "FG", "DI", "SK", "ST", "EN", "DU", "PH", "FO", "PA", "SC", "DF", "PS", "EX", "LD", "MO",
] as const;
export type RatingKey = (typeof RATING_KEYS)[number];

/** One parameter's full trace: the numbers behind the final rating. */
export interface RatingCell {
  raw: number; // raw skill metric (parameter-native units)
  percentile: number; // 0-1 within comparison group vs the league reference
  curveRating: number; // percentile → PNHL curve
  absoluteRating: number; // raw → absolute historical scale
  confidence: number; // 0-100 sample confidence
  final: number; // 0.85*curve + 0.15*absolute, clamped, + override
  reason?: string; // human-readable "why" (auto or override)
}

export interface RatingBundle {
  id: string;
  name: string;
  pos: Pos;
  cells: Record<RatingKey, RatingCell>;
  final: Record<RatingKey, number>;
  // MO is default 50, PO/OV are intentionally NOT produced (left to STHS). Kept here as notes.
  notes: string[];
}
