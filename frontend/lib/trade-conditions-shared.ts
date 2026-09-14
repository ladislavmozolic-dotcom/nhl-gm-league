// Pure constants/types for structured trade conditions — split out from
// lib/trade-conditions-server.ts (which imports prisma) so client components
// like the Trade Builder's condition modal can import them without pulling a
// server-only module into the browser bundle.

export const METRICS = ["POINTS", "GOALS", "ASSISTS", "GAMES_PLAYED", "PPG"] as const;
export type Metric = (typeof METRICS)[number];
export const METRIC_LABELS: Record<Metric, string> = {
  POINTS: "Points", GOALS: "Goals", ASSISTS: "Assists", GAMES_PLAYED: "Games Played", PPG: "Points per Game",
};

export const OPS = ["GTE", "GT", "LTE", "LT"] as const;
export type Op = (typeof OPS)[number];
export const OP_LABELS: Record<Op, string> = { GTE: "≥", GT: ">", LTE: "≤", LT: "<" };

/** A structured conditional-pick clause as captured in the Trade Builder,
 *  before the trade is proposed — mirrors TradeCondition's structured columns.
 *  `ownerTeamId` is whichever side's OWN picks this governs (the side sending
 *  the player) — the trade action derives the condition's fromTeamId/toTeamId
 *  from it, since a Trade record's own fromTeamId/toTeamId is fixed to
 *  "me → opp" regardless of which side's player/picks are actually involved. */
export type ConditionSpec = {
  ownerTeamId: number;
  playerId: number;
  playerName: string;
  seasonYear: number;
  metric: Metric; op: Op; threshold: number;
  metric2?: Metric; op2?: Op; threshold2?: number; logic2?: "AND" | "OR";
  pickAId: number; pickALabel: string;
  pickBId: number; pickBLabel: string;
};

const opLabel = (op: string) => OP_LABELS[op as Op] ?? op;

/** One-line human summary of a spec — used both for the Trade Builder's own
 *  chip/preview and as the auto-generated TradeCondition.description when the
 *  GM doesn't type free text of their own. */
export function describeConditionSpec(spec: ConditionSpec): string {
  const clause1 = `${METRIC_LABELS[spec.metric]} ${opLabel(spec.op)} ${spec.threshold}`;
  const clause2 = spec.metric2 && spec.op2 && spec.threshold2 != null
    ? ` ${spec.logic2 === "OR" ? "OR" : "AND"} ${METRIC_LABELS[spec.metric2]} ${opLabel(spec.op2)} ${spec.threshold2}`
    : "";
  return `Conditional pick: if ${spec.playerName} does NOT clear ${clause1}${clause2} in ${spec.seasonYear}-${String(spec.seasonYear + 1).slice(-2)} (real NHL stats), the ${spec.pickALabel} conveys as-is; if he DOES, the ${spec.pickBLabel} conveys instead.`;
}
