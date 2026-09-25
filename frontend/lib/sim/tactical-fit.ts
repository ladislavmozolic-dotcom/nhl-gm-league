// Tactical fit shared by the editable Lines screen and the read-only Line Builder.
// Keeping the calculation here ensures both screens always show the same value.

import { roleFitOf, type RoleFitAttrs } from "./role-fit";
import { systemFit, type DZone, type PuckStyle, type TeamTactics } from "./tactics";
import { playerType } from "../player-type";

export type TacticalFitPlayer = RoleFitAttrs & {
  position?: string | null;
  shoots?: string | null;
  en?: number | null;
  weight?: number | null;
  ph?: number | null;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// Depth-chart archetype — reuses the SAME scouting-style player TYPE shown on a
// player's profile (lib/player-type.ts's playerType(), the commissioner's real
// Role Classification rules), so "who belongs on this line" is judged by the
// league's own role labels rather than a made-up separate scale. Mirrors
// lines-core.ts's F_TACTIC/D_TACTIC defaults: 1st/2nd attack, 3rd checking, 4th
// physical/energy; top D pair two-way, 2nd defensive, 3rd shut-down.
const LINE_ARCHETYPE_F: { desired: string[]; strictness: number }[] = [
  { desired: ["Elite Forward", "Dual-Threat", "Sniper", "Playmaker", "Offensive Forward"], strictness: 1.0 },
  { desired: ["Elite Forward", "Dual-Threat", "Sniper", "Playmaker", "Offensive Forward", "Two-Way Forward"], strictness: 0.7 },
  { desired: ["Two-Way Forward", "Defensive Forward", "Forechecker / Grinder"], strictness: 0.7 },
  { desired: ["Forechecker / Grinder", "Defensive Forward"], strictness: 1.0 },
];
const LINE_ARCHETYPE_D: { desired: string[]; strictness: number }[] = [
  { desired: ["Elite Defenseman", "Two-Way Defenceman", "Offensive Defenceman"], strictness: 0.6 },
  { desired: ["Two-Way Defenceman", "Defensive Defenceman"], strictness: 0.8 },
  { desired: ["Defensive Defenceman", "Stay-at-Home Defenceman"], strictness: 1.0 },
];

/** 0..1 → how many of this unit's CLASSIFIED members are a type this depth-chart
 *  slot wants, turned into a multiplier centred on 1.0 (neutral when nobody on
 *  the unit classifies — not enough ratings to judge). `strictness` sets how far
 *  a mismatch swings the score: the 4th line/3rd pair care a lot, a top pair
 *  barely (it's already rewarded for an off/def mix by roleFitOf above). */
function archetypeFactor(types: (string | null)[], slot: { desired: string[]; strictness: number } | undefined): number {
  if (!slot) return 1;
  const classified = types.filter((t): t is string => t != null);
  if (!classified.length) return 1;
  const matchRatio = classified.filter((t) => slot.desired.includes(t)).length / classified.length;
  const range = 0.15 * slot.strictness;
  return 1 - range + matchRatio * 2 * range;
}

function unitProfile(present: TacticalFitPlayer[]) {
  const avg = (key: keyof Pick<TacticalFitPlayer, "sk" | "en" | "ck" | "sc" | "pa" | "df" | "st" | "weight">, fallback: number) =>
    present.reduce((sum, player) => sum + (player[key] ?? fallback), 0) / present.length;
  return {
    sk: avg("sk", 50), en: avg("en", 50), ck: avg("ck", 50), sc: avg("sc", 50),
    pa: avg("pa", 50), df: avg("df", 50), st: avg("st", 50), weight: avg("weight", 90),
  };
}

/** Forward-line fit: role mix × natural position × fit for the effective system. */
export function tacticalFitForwards(
  players: (TacticalFitPlayer | null)[],
  tactics: TeamTactics,
  puckOverride?: PuckStyle,
  lineIndex?: number,
): number {
  const present = players.filter((player): player is TacticalFitPlayer => player != null);
  if (present.length < 2) return 0;

  const roleScore = roleFitOf(present, false) * 100;
  const slots = ["LW", "C", "RW"];
  let good = 0;
  let count = 0;
  players.forEach((player, index) => {
    if (!player) return;
    count++;
    const position = (player.position ?? "").toUpperCase();
    const wanted = slots[index];
    const natural = wanted === "C"
      ? /C|F/.test(position)
      : position.includes(wanted) || /\bW\b|F/.test(position) || position === "LW/RW"
        || (wanted === "LW" && /L/.test(position)) || (wanted === "RW" && /R/.test(position));
    if (natural) good++;
  });
  const positionFactor = count ? 0.75 + 0.25 * (good / count) : 0.85;
  const effectiveTactics = puckOverride ? { ...tactics, puckStyle: puckOverride } : tactics;
  const types = present.map((p) => playerType({ position: p.position, sc: p.sc, pa: p.pa, df: p.df, ck: p.ck, st: p.st, sk: p.sk, ph: p.ph }));
  const archFactor = lineIndex != null ? archetypeFactor(types, LINE_ARCHETYPE_F[lineIndex]) : 1;
  return clamp(roleScore * positionFactor * systemFit(unitProfile(present), effectiveTactics) * archFactor);
}

/** Defence-pair fit: role mix × correct side/handedness × effective system fit. */
export function tacticalFitDefense(
  players: (TacticalFitPlayer | null)[],
  tactics: TeamTactics,
  dZoneOverride?: DZone,
  lineIndex?: number,
): number {
  const present = players.filter((player): player is TacticalFitPlayer => player != null);
  if (present.length < 2) return 0;

  const roleScore = roleFitOf(present, true) * 100;
  let good = 0;
  if (players[0]?.shoots === "L") good++;
  if (players[1]?.shoots === "R") good++;
  const positionFactor = 0.78 + 0.22 * (good / 2);
  const effectiveTactics = dZoneOverride ? { ...tactics, dZone: dZoneOverride } : tactics;
  const types = present.map((p) => playerType({ position: p.position, sc: p.sc, pa: p.pa, df: p.df, ck: p.ck, st: p.st, sk: p.sk, ph: p.ph }));
  const archFactor = lineIndex != null ? archetypeFactor(types, LINE_ARCHETYPE_D[lineIndex]) : 1;
  return clamp(roleScore * positionFactor * systemFit(unitProfile(present), effectiveTactics) * archFactor);
}
