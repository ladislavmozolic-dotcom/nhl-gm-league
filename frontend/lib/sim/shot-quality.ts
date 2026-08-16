// Phase 2 — shot quality / expected goals (xG).
//
// Every shot in the possession loop is tagged with a LOCATION (sector), a SHOT
// TYPE and an xG: the probability an average shooter would beat an average
// goalie from that spot in that situation. xG is deliberately independent of the
// actual shooter's finishing and the actual goalie's quality — those show up as
// goals-above-expected (individual finishing) and goals-saved-above-expected
// (GSAx) once we compare xG to what really happened.
//
// Calibrated so the league-average xG per shot lands near the real shooting %
// (~0.083), matching the engine's baseConversion, so team xGF ≈ goals over a
// season and GSAx centres on zero for an average keeper.

import type { RNG } from "./rng";

export type ShotSector = "POINT" | "PERIMETER" | "CIRCLE" | "SLOT" | "NET_FRONT";
export type ShotType = "SLAP" | "WRIST" | "SNAP" | "BACKHAND" | "TIP" | "ONE_TIMER";
export type ShotStrength = "EV" | "PP" | "SH";

// Baseline expected-goals by location (an average shooter vs an average goalie).
// SCALE lifts the whole curve so the league-average xG per shot matches the
// engine's realised shooting % (≈0.10), keeping xGF ≈ goals and GSAx centred.
const SCALE = 1.0;
const SECTOR_XG: Record<ShotSector, number> = {
  POINT: 0.022 * SCALE,      // a defenceman's shot from the blue line (screens/tips aside)
  PERIMETER: 0.045 * SCALE,  // a forward's own-rush shot from the outside
  CIRCLE: 0.095 * SCALE,     // a look from the faceoff dots / mid-slot
  SLOT: 0.17 * SCALE,        // a one-timer / high-slot chance
  NET_FRONT: 0.23 * SCALE,   // a rebound / tip right at the crease
};

// Shot-type modifier (relative to a clean wrist shot).
const TYPE_MULT: Record<ShotType, number> = {
  SLAP: 0.95,
  WRIST: 1.0,
  SNAP: 1.05,
  BACKHAND: 0.9,
  TIP: 1.12,
  ONE_TIMER: 1.2,
};

const STRENGTH_MULT: Record<ShotStrength, number> = { EV: 1.0, PP: 1.15, SH: 0.85 };

// Map the possession-loop setup to a plausible location + shot type. `setup` is
// how the puck arrived: a D-man shot is a point slapper, a pass sets up a slot
// one-timer, a rebound is a net-front scramble, a plain carry is a mid look.
export function shotProfile(
  rng: RNG,
  opts: { isDefense: boolean; setup: "carry" | "pass" | "rebound"; danger: number; dangerBias?: number },
): { sector: ShotSector; shotType: ShotType } {
  // team-system chance quality (rush > 1 → more slot; shot-volume < 1 → more
  // perimeter/point). Clamped so it nudges the mix rather than dominating it.
  const bias = Math.max(0.7, Math.min(1.35, opts.dangerBias ?? 1));
  if (opts.isDefense) {
    // most are point shots, but an offensive D pinches / joins the rush for a better
    // look — walking the line into the circle or sneaking to the slot backdoor.
    const r = rng.next();
    if (r < 0.07) return { sector: "SLOT", shotType: "ONE_TIMER" };            // backdoor / pinch to the slot
    if (r < 0.20) return { sector: "CIRCLE", shotType: rng.chance(0.5) ? "SNAP" : "WRIST" }; // walks the line
    return { sector: "POINT", shotType: rng.chance(0.55) ? "SLAP" : "WRIST" };
  }
  if (opts.setup === "rebound") {
    return { sector: "NET_FRONT", shotType: rng.chance(0.4) ? "TIP" : "WRIST" };
  }
  if (opts.setup === "pass") {
    // a cross-ice feed: usually a slot one-timer, sometimes off the circle
    return rng.chance(Math.min(0.9, 0.72 * bias))
      ? { sector: "SLOT", shotType: "ONE_TIMER" }
      : { sector: "CIRCLE", shotType: rng.chance(0.5) ? "SNAP" : "ONE_TIMER" };
  }
  // plain carry — a forward's own-rush look: some drive the slot, most settle for
  // a mid look off the circle, the rest fire from the perimeter. The system's
  // chance-quality bias shifts how many get to the slot.
  const slotP = 0.3 * bias;
  const circleP = slotP + 0.35;
  const r = rng.next();
  if (r < slotP) return { sector: "SLOT", shotType: rng.chance(0.5) ? "WRIST" : "SNAP" };
  if (r < circleP) return { sector: "CIRCLE", shotType: rng.chance(0.6) ? "WRIST" : "SNAP" };
  return { sector: "PERIMETER", shotType: rng.chance(0.7) ? "WRIST" : "BACKHAND" };
}

/** Expected goals for a shot from `sector` of `shotType` at `strength`, with mild jitter. */
export function expectedGoal(
  rng: RNG,
  sector: ShotSector,
  shotType: ShotType,
  strength: ShotStrength,
): number {
  const base = SECTOR_XG[sector] * TYPE_MULT[shotType] * STRENGTH_MULT[strength];
  const jitter = 0.9 + rng.next() * 0.2; // ±10%
  return Math.max(0.005, Math.min(0.6, base * jitter));
}

/** A high-danger chance: the slot or the net-front. */
export function isHighDanger(sector: ShotSector): boolean {
  return sector === "SLOT" || sector === "NET_FRONT";
}

// The 5 shot sectors in a fixed order (for compact per-team storage / heatmaps).
export const SECTORS: ShotSector[] = ["POINT", "PERIMETER", "CIRCLE", "SLOT", "NET_FRONT"];
export const sectorIndex = (s: ShotSector): number => SECTORS.indexOf(s);

// --- NHL EDGE-style tracking: shot speed (mph) -------------------------------
// A synthesised puck speed off the stick, from the shot type and the shooter's
// shot power (SC). Slap shots are hardest, tips/backhands softest; an elite
// shooter adds ~10 mph over a fourth-liner. Real NHL: ~70-90 mph, record ~108.
const TYPE_MPH: Record<ShotType, number> = {
  SLAP: 88, ONE_TIMER: 84, SNAP: 78, WRIST: 72, BACKHAND: 62, TIP: 58,
};

/** Shot speed in mph for a shot of `shotType` by a shooter with shot rating `sc` (0..99). */
export function shotSpeed(rng: RNG, shotType: ShotType, sc: number): number {
  const base = TYPE_MPH[shotType];
  const skill = (sc - 60) * 0.35;          // ±~14 mph across the rating range
  const jitter = (rng.next() - 0.5) * 8;   // ±4 mph
  return Math.max(45, Math.min(108, base + skill + jitter));
}
