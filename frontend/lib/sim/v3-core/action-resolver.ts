// V3 Core step 3: converts an intended action into explainable outcome chances.
// Sampling is intentionally deferred to the future prototype game loop.
import type { CoreAction, CorePlayerProfile } from "./decision-engine";
import type { RelativeZone } from "./match-state";

export type CoreResolution = {
  action: CoreAction;
  successChance: number;
  turnoverChance: number;
  nextZone: RelativeZone;
  shotQuality?: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
};
export type CoreResolutionInput = {
  action: CoreAction;
  zone: RelativeZone;
  pressure: number;
  fatigue: number;
  actor: CorePlayerProfile;
  primaryDefender: Pick<CorePlayerProfile, "skating" | "defense" | "physical"> & { blocking?: number };
};

const clamp = (n: number, lo = 0.02, hi = 0.98) => Math.max(lo, Math.min(hi, n));
const rating = (n: number) => (n - 50) / 100;
// A clean NHL possession should usually continue.  Skill decides the spread
// around that baseline; pressure and fatigue then make a safe play less safe.
// Starting at 0.50 meant two average skaters lost the puck on every other
// touch, which is neither realistic nor a useful base for the later event loop.
const contest = (attack: number, defend: number, pressure: number, fatigue: number) => clamp(0.66 + rating(attack) - rating(defend) - pressure * 0.12 - fatigue * 0.1);

export function resolveCoreAction(input: CoreResolutionInput): CoreResolution {
  const d = input.primaryDefender;
  const sk = contest(input.actor.skating * 0.6 + input.actor.puckHandling * 0.4, d.skating * 0.45 + d.defense * 0.55, input.pressure, input.fatigue);
  const pass = contest(input.actor.passing, d.defense, input.pressure, input.fatigue);
  const shot = contest(input.actor.shooting, d.defense * 0.55 + (d.blocking ?? d.defense) * 0.45, input.pressure * 0.45, input.fatigue * 0.35);
  const physical = contest(input.actor.physical, d.physical, input.pressure * 0.4, input.fatigue * 0.35);
  const result = (successChance: number, nextZone: RelativeZone, reason: string, shotQuality?: CoreResolution["shotQuality"]): CoreResolution => ({ action: input.action, successChance, turnoverChance: 1 - successChance, nextZone, shotQuality, reason });

  switch (input.action) {
    case "CARRY": return result(sk, input.zone === "DEFENSIVE" ? "NEUTRAL" : "OFFENSIVE", "skating and puck control versus gap defence");
    case "PASS": return result(pass, input.zone, "passing skill versus defensive reads");
    case "DUMP_IN": return result(clamp(0.48 + physical * 0.32 - input.pressure * 0.08), "OFFENSIVE", "forecheck recovery after a controlled dump-in");
    case "CLEAR": return result(clamp(0.66 + physical * 0.18 - input.pressure * 0.12), "NEUTRAL", "clearance under defensive-zone pressure");
    case "SHOOT": return result(shot, "OFFENSIVE", "shooting skill against defending lane", shot > 0.66 ? "HIGH" : shot > 0.45 ? "MEDIUM" : "LOW");
    case "FORECHECK": return result(clamp(0.3 + physical * 0.27 + sk * 0.18), "OFFENSIVE", "forecheck pressure and puck recovery");
    case "BLOCK": return result(clamp(0.28 + rating(d.blocking ?? d.defense) + input.pressure * 0.12), "DEFENSIVE", "defender blocks the shooting lane");
    case "CONTAIN": return result(clamp(0.48 + rating(d.defense) + input.pressure * 0.08), "DEFENSIVE", "defensive structure denies the middle");
  }
}
