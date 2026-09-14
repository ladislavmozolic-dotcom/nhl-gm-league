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

/** Localized metric/op labels for the Trade Builder UI (falls back to English
 *  via METRIC_LABELS/OP_LABELS through the same t() fallback chain as the rest
 *  of the site's i18n). Server-side/admin usages keep the plain English maps
 *  above — only the GM-facing condition modal needs to react to the site's
 *  language cookie. */
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

/** A structured conditional-pick clause as captured in the Trade Builder,
 *  before the trade is proposed — mirrors TradeCondition's structured columns.
 *  Up to 3 stat clauses total (metric/op/threshold is always clause 1;
 *  metric2.../metric3... are optional additional clauses, each combined with
 *  the running result via its own logic field).
 *  `ownerTeamId` is whichever side's OWN picks this governs — that's the side
 *  ACQUIRING the tracked player (a real conditional-pick clause is always the
 *  receiving club conditionally sending a pick BACK, based on how well the
 *  player performs for them; e.g. "Vegas sends Ottawa a 2nd, upgrading to a
 *  3rd if Hertl clears the bar"), never the side giving the player up. The
 *  trade action derives the condition's fromTeamId/toTeamId from it, since a
 *  Trade record's own fromTeamId/toTeamId is fixed to "me → opp" regardless of
 *  which side's player/picks are actually involved. */
export type ConditionSpec = {
  ownerTeamId: number;
  playerId: number;
  playerName: string;
  seasonYear: number;
  metric: Metric; op: Op; threshold: number;
  metric2?: Metric; op2?: Op; threshold2?: number; logic2?: "AND" | "OR";
  metric3?: Metric; op3?: Op; threshold3?: number; logic3?: "AND" | "OR";
  pickAId: number; pickALabel: string;
  pickBId: number; pickBLabel: string;
};

/** One-line human summary of a spec — used both for the Trade Builder's own
 *  chip/preview (localized to `lang`) and as the auto-generated
 *  TradeCondition.description when the GM doesn't type free text of their own
 *  (always English there, since that's a permanent admin-facing record). */
export function describeConditionSpec(spec: ConditionSpec, lang: Lang = "en"): string {
  const ml = (m: Metric) => metricLabel(lang, m);
  const ol = (o: Op) => opLabelFor(lang, o);
  let clauses = `${ml(spec.metric)} ${ol(spec.op)} ${spec.threshold}`;
  if (spec.metric2 && spec.op2 && spec.threshold2 != null) {
    clauses += ` ${spec.logic2 === "OR" ? t(lang, "cond.or") : t(lang, "cond.and")} ${ml(spec.metric2)} ${ol(spec.op2)} ${spec.threshold2}`;
  }
  if (spec.metric3 && spec.op3 && spec.threshold3 != null) {
    clauses += ` ${spec.logic3 === "OR" ? t(lang, "cond.or") : t(lang, "cond.and")} ${ml(spec.metric3)} ${ol(spec.op3)} ${spec.threshold3}`;
  }
  const season = `${spec.seasonYear}-${String(spec.seasonYear + 1).slice(-2)}`;
  return t(lang, "cond.describe")
    .replace("{player}", spec.playerName)
    .replace("{clauses}", clauses)
    .replace("{season}", season)
    .replace("{pickA}", spec.pickALabel)
    .replace("{pickB}", spec.pickBLabel);
}
