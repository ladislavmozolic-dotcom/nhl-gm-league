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
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const ZONE = { DEF: "DEFENSIVE", NEU: "NEUTRAL", OFF: "OFFENSIVE" } as const;

/** Core's ranked candidates for this moment (with possession). */
export function coreCandidates(ctx: CoreEngineContext): Array<{ action: CoreAction; score: number }> {
  return decideCoreAction({
    hasPossession: true,
    zone: ZONE[ctx.zone],
    // pressure APPLIED TO the carrier's team: in his own end a long stay means he is the one hemmed in
    pressure: ctx.zone === "DEF" ? clamp01(ctx.pressureSeconds / 40) : 0,
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
