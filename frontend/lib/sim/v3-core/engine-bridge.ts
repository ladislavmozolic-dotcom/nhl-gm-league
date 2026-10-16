// V3 Core ↔ V3 engine bridge (hybrid step 1). The production V3 loop keeps resolution, events and calibration;
// Core supplies the INTENT: given the live game state, how much does this carrier want to shoot rather than
// pass / keep carrying? Pure, no RNG — the engine samples the returned share with its own seeded RNG.
import type { SimSkater, SimTeam } from "../types";
import { decideCoreAction, type CoreAction } from "./decision-engine";
import { coreProfileFromSkater, coreTacticsFromSimTeam } from "./adapter";

export type CoreEngineContext = {
  carrier: Pick<SimSkater, "id" | "type" | "attrs">;
  team: Pick<SimTeam, "teamTactics">;
  zone: "DEF" | "NEU" | "OFF";      // the engine's zone, relative to the carrier's team
  shiftSeconds: number;            // how long the carrier's unit has been out
  pressureSeconds: number;         // how long the puck has been in this zone (a long O-zone stay = the defence is under pressure)
  scoreMargin: number;             // carrier's team − opponent
  secondsRemaining: number;        // regulation seconds left (≥ 0)
  rebound: boolean;                // the look comes off a rebound / loose puck
  oppForecheck?: number;           // 0..1 how hard the opponent forechecks (pressure on a neutral-zone carrier)
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const ZONE = { DEF: "DEFENSIVE", NEU: "NEUTRAL", OFF: "OFFENSIVE" } as const;

/** Core's ranked candidates for this moment (with possession). */
export function coreCandidates(ctx: CoreEngineContext): Array<{ action: CoreAction; score: number }> {
  return decideCoreAction({
    hasPossession: true,
    zone: ZONE[ctx.zone],
    // pressure APPLIED TO the carrier's team: in his own end a long stay means he is the one hemmed in
    pressure: ctx.zone === "DEF" ? clamp01(ctx.pressureSeconds / 40) : ctx.zone === "NEU" ? clamp01((ctx.oppForecheck ?? 0.5) * 0.7) : 0,
    fatigue: clamp01((ctx.shiftSeconds - 30) / 70),
    scoreMargin: ctx.scoreMargin,
    secondsRemaining: Math.max(0, ctx.secondsRemaining),
    rebound: ctx.rebound,
    carrier: coreProfileFromSkater(ctx.carrier),
    tactics: coreTacticsFromSimTeam(ctx.team),
  }).candidates;
}

/** In the offensive zone: Core's share of SHOOT among the shoot / pass choices (carrying on is folded into "not yet"). */
export function coreShootShare(ctx: CoreEngineContext): number {
  const c = coreCandidates({ ...ctx, zone: "OFF" });
  const shoot = c.find((x) => x.action === "SHOOT")?.score ?? 0, pass = c.find((x) => x.action === "PASS")?.score ?? 0;
  return shoot + pass > 0 ? shoot / (shoot + pass) : 0.5;
}

/** In the neutral zone: Core's share of DUMP_IN among carry / pass / dump (how much this unit, right now, wants to chip it in). */
export function coreDumpShare(ctx: CoreEngineContext): number {
  const c = coreCandidates({ ...ctx, zone: "NEU", rebound: false });
  const total = c.reduce((n, x) => n + x.score, 0);
  return total > 0 ? (c.find((x) => x.action === "DUMP_IN")?.score ?? 0) / total : 0.2;
}

/** In the defensive zone: Core's share of CLEAR (just get it out) among clear / breakout pass / carry —
 *  high under a long hem-in, with tired legs or protecting a late lead; a puck-moving D wants to make a play. */
export function coreClearShare(ctx: CoreEngineContext): number {
  const c = coreCandidates({ ...ctx, zone: "DEF", rebound: false });
  const total = c.reduce((n, x) => n + x.score, 0);
  return total > 0 ? (c.find((x) => x.action === "CLEAR")?.score ?? 0) / total : 0.33;
}
