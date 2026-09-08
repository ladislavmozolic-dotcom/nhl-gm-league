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
import type { PpStyle, PkStyle } from "./tactics";

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

// Formation-specific shot-location mix for a power play — each classic PP
// structure puts the puck in a different place, not just "more of it": 1-3-1
// lives on the flank one-timer through the slot, Umbrella works it from the
// point with net-front traffic, Overload grinds it low for a net-front/backdoor
// look. This REPLACES the generic carry/pass zone roll for a PP shot (a
// rebound scramble stays generic — a loose puck doesn't care about formation).
// manAdv3 (a true 5-on-3) pushes every formation further toward its own
// high-danger signature — the extra open ice amplifies whatever look it hunts.
const PP_FORMATION_MIX: Record<PpStyle, { netFrontP: number; slotP: number; oneTimerP: number }> = {
  balanced: { netFrontP: 0.16, slotP: 0.34, oneTimerP: 0.55 },
  umbrella: { netFrontP: 0.26, slotP: 0.24, oneTimerP: 0.45 },   // point shots + screens/tips up front
  "131": { netFrontP: 0.12, slotP: 0.50, oneTimerP: 0.80 },      // the flank seam one-timer
  overload: { netFrontP: 0.30, slotP: 0.28, oneTimerP: 0.45 },   // low cycle, net-front / backdoor
};

// The DEFENDING PK structure reshapes the attacker's zone mix on top of its
// own formation — real coaching intent, not just a flat conversion tax:
//   Box     protects the middle across the board — pushes everything toward
//           the perimeter/circle, both net-front and slot suppressed evenly.
//   Diamond denies the seam pass specifically (its point man pressures, and
//           the two flanks cut the cross-ice lane) — sharply down on SLOT,
//           but only one D fronts the net, so NET_FRONT traffic goes UP.
//   Aggressive hunts the puck high — when it's NOT beaten the shot never
//           develops (already the lowest pkSuppress), but a beaten
//           aggressive kill has nobody left to contest what gets through —
//           the shots that DO happen skew more dangerous, not less.
const PK_ZONE_ADJUST: Record<PkStyle, { netFront: number; slot: number }> = {
  balanced: { netFront: 1, slot: 1 },
  box: { netFront: 0.82, slot: 0.85 },
  diamond: { netFront: 1.2, slot: 0.7 },
  aggressive: { netFront: 1.15, slot: 1.1 },
};

export function ppShotProfile(
  rng: RNG,
  style: PpStyle,
  opts: { isDefense: boolean; setup: "carry" | "pass" | "rebound"; manAdv3?: boolean; pkStyle?: PkStyle },
): { sector: ShotSector; shotType: ShotType } {
  if (opts.isDefense || opts.setup === "rebound") return shotProfile(rng, { isDefense: opts.isDefense, setup: opts.setup, danger: 1 });
  const mix = PP_FORMATION_MIX[style] ?? PP_FORMATION_MIX.balanced;
  const boost = opts.manAdv3 ? 1.25 : 1; // extra space on a 5-on-3 sharpens whatever look the formation hunts
  const pkAdj = PK_ZONE_ADJUST[opts.pkStyle ?? "balanced"] ?? PK_ZONE_ADJUST.balanced;
  const netFrontP = Math.min(0.5, mix.netFrontP * boost * pkAdj.netFront);
  const slotP = Math.min(0.75, mix.slotP * boost * pkAdj.slot);
  const r = rng.next();
  if (r < netFrontP) return { sector: "NET_FRONT", shotType: rng.chance(0.5) ? "TIP" : "WRIST" };
  if (r < netFrontP + slotP) return { sector: "SLOT", shotType: rng.chance(mix.oneTimerP) ? "ONE_TIMER" : "SNAP" };
  return { sector: "CIRCLE", shotType: rng.chance(0.5) ? "SNAP" : "WRIST" };
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
