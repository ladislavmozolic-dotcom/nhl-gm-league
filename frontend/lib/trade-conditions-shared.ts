// Pure constants/types for structured trade conditions — split out from
// lib/trade-conditions-server.ts (which imports prisma) so client components
// like the Trade Builder's condition modal can import them without pulling a
// server-only module into the browser bundle.

import { t, type Lang } from "./i18n";

export const METRICS = ["POINTS", "GOALS", "ASSISTS", "GAMES_PLAYED", "PPG"] as const;
export type Metric = (typeof METRICS)[number];
export const METRIC_LABELS: Record<Metric, string> = {
  POINTS: "Points", GOALS: "Goals", ASSISTS: "Assists", GAMES_PLAYED: "Games Played", PPG: "Points per Game",
};

export const OPS = ["GTE", "GT", "LTE", "LT"] as const;
export type Op = (typeof OPS)[number];
export const OP_LABELS: Record<Op, string> = { GTE: "≥", GT: ">", LTE: "≤", LT: "<" };

export const PLAYOFF_ROUNDS = ["MADE_PLAYOFFS", "WON_R1", "WON_R2", "WON_CONF", "WON_CUP"] as const;
export type PlayoffRound = (typeof PLAYOFF_ROUNDS)[number];
export const PLAYOFF_ROUND_LABELS: Record<PlayoffRound, string> = {
  MADE_PLAYOFFS: "Makes the playoffs", WON_R1: "Wins Round 1", WON_R2: "Wins Round 2",
  WON_CONF: "Wins the Conference Final", WON_CUP: "Wins the Stanley Cup",
};

export const LOTTERY_THRESHOLDS = [10, 15] as const;
export type LotteryThreshold = (typeof LOTTERY_THRESHOLDS)[number];

/** Localized metric/op/round labels for the Trade Builder UI (falls back to
 *  English through the same t() fallback chain as the rest of the site's
 *  i18n). Server-side/admin usages keep the plain English maps above — only
 *  the GM-facing condition modal needs to react to the site's language
 *  cookie. */
export function metricLabel(lang: Lang, m: Metric): string {
  const key = `cond.metric.${m}`;
  const v = t(lang, key);
  return v === key ? METRIC_LABELS[m] : v;
}
export function opLabelFor(lang: Lang, op: Op): string {
  const key = `cond.op.${op}`;
  const v = t(lang, key);
  return v === key ? OP_LABELS[op] : v;
}
export function roundLabel(lang: Lang, r: PlayoffRound): string {
  const key = `cond.round.${r}`;
  const v = t(lang, key);
  return v === key ? PLAYOFF_ROUND_LABELS[r] : v;
}

/** One stat clause — a metric compared against a threshold for a given
 *  season, sourced either from the player's REAL NHL production or from this
 *  league's (UNHL) own simulated games. */
export type StatClause = { kind: "STAT"; source: "REAL_NHL" | "UNHL"; seasonYear: number; metric: Metric; op: Op; threshold: number; logic?: "AND" | "OR" };
/** UNHL-only: how far the tracked player's new club (the condition's
 *  ownerTeamId) advances in a given UNHL season's playoffs. */
export type PlayoffClause = { kind: "PLAYOFF_ROUND"; seasonYear: number; round: PlayoffRound; logic?: "AND" | "OR" };
/** UNHL-only: whether the tracked player signs a new contract (extension or
 *  fresh deal) with the acquiring club before the condition is resolved. */
export type ContractClause = { kind: "CONTRACT_EXT"; extended: boolean; logic?: "AND" | "OR" };
/** A classic "protected 1st round pick": Pick A (the upgrade the other
 *  clauses would otherwise send) IS the pick being protected. This clause
 *  passes when Pick A's ORIGINAL team does NOT land within the top
 *  `threshold` slots of Pick A's own Draft Lottery year — i.e. it's safe to
 *  convey. If that team DOES land that high, Pick A is protected (doesn't
 *  convey) and Pick B (the default, e.g. a future 1st) stays out as usual.
 *  Combines with any other clauses via the normal AND/OR chain — on its own
 *  (no other clauses) it makes Pick A a plain protected pick with no player
 *  performance attached. */
export type LotteryClause = { kind: "LOTTERY_PROTECTION"; threshold: LotteryThreshold; logic?: "AND" | "OR" };
export type ConditionClause = StatClause | PlayoffClause | ContractClause | LotteryClause;

/** A structured conditional-pick clause as captured in the Trade Builder,
 *  before the trade is proposed — mirrors TradeCondition's structured
 *  columns. Up to 3 clauses total, combined left-to-right via each clause's
 *  own `logic` (ignored on the first clause).
 *  `ownerTeamId` is whichever side's OWN picks this governs — that's the side
 *  ACQUIRING the tracked player (a real conditional-pick clause is always the
 *  receiving club conditionally sending a pick BACK, based on how well the
 *  player performs for them; e.g. "Vegas sends Ottawa a 2nd, upgrading to a
 *  3rd if Hertl clears the bar"), never the side giving the player up — or,
 *  for a LOTTERY_PROTECTION clause, the side whose own future pick is on the
 *  line. The trade action derives the condition's fromTeamId/toTeamId from
 *  it, since a Trade record's own fromTeamId/toTeamId is fixed to "me → opp"
 *  regardless of which side's player/picks are actually involved.
 *  `playerId`/`playerName` are absent for a pure LOTTERY_PROTECTION spec —
 *  there's no player to track, just the pick itself. */
export type ConditionSpec = {
  ownerTeamId: number;
  playerId?: number;
  playerName?: string;
  clauses: ConditionClause[];
  pickAId: number; pickALabel: string;
  pickBId: number; pickBLabel: string;
};

function describeClause(lang: Lang, c: ConditionClause): string {
  const seasonStr = (y: number) => `${y}-${String(y + 1).slice(-2)}`;
  switch (c.kind) {
    case "STAT": {
      const src = t(lang, c.source === "UNHL" ? "cond.source.UNHL" : "cond.source.REAL_NHL");
      return `${metricLabel(lang, c.metric)} ${opLabelFor(lang, c.op)} ${c.threshold} (${src} ${seasonStr(c.seasonYear)})`;
    }
    case "PLAYOFF_ROUND":
      return `${roundLabel(lang, c.round)} (${seasonStr(c.seasonYear)}, ${t(lang, "cond.source.UNHL")})`;
    case "CONTRACT_EXT":
      return t(lang, c.extended ? "cond.contractExtYes" : "cond.contractExtNo");
    case "LOTTERY_PROTECTION":
      return t(lang, "cond.lotteryClauseDesc").replace("{threshold}", String(c.threshold));
  }
}

/** One-line human summary of a spec — used both for the Trade Builder's own
 *  chip/preview (localized to `lang`) and as the auto-generated
 *  TradeCondition.description when the GM doesn't type free text of their own
 *  (always English there, since that's a permanent admin-facing record). */
export function describeConditionSpec(spec: ConditionSpec, lang: Lang = "en"): string {
  const clausesText = spec.clauses
    .map((c, i) => (i === 0 ? describeClause(lang, c) : ` ${t(lang, c.logic === "OR" ? "cond.or" : "cond.and")} ${describeClause(lang, c)}`))
    .join("");
  const subject = spec.playerName ? `${spec.playerName}: ` : "";
  return subject + t(lang, "cond.describe")
    .replaceAll("{clauses}", clausesText)
    .replaceAll("{pickA}", spec.pickALabel)
    .replaceAll("{pickB}", spec.pickBLabel);
}
