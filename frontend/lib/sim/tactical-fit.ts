// Tactical fit shared by the editable Lines screen and the read-only Line Builder.
// Keeping the calculation here ensures both screens always show the same value.

import { roleFitOf, type RoleFitAttrs } from "./role-fit";
import { systemFit, type DZone, type PuckStyle, type TeamTactics } from "./tactics";

export type TacticalFitPlayer = RoleFitAttrs & {
  position?: string | null;
  shoots?: string | null;
  en?: number | null;
  weight?: number | null;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

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
  return clamp(roleScore * positionFactor * systemFit(unitProfile(present), effectiveTactics));
}

/** Defence-pair fit: role mix × correct side/handedness × effective system fit. */
export function tacticalFitDefense(
  players: (TacticalFitPlayer | null)[],
  tactics: TeamTactics,
  dZoneOverride?: DZone,
): number {
  const present = players.filter((player): player is TacticalFitPlayer => player != null);
  if (present.length < 2) return 0;

  const roleScore = roleFitOf(present, true) * 100;
  let good = 0;
  if (players[0]?.shoots === "L") good++;
  if (players[1]?.shoots === "R") good++;
  const positionFactor = 0.78 + 0.22 * (good / 2);
  const effectiveTactics = dZoneOverride ? { ...tactics, dZone: dZoneOverride } : tactics;
  return clamp(roleScore * positionFactor * systemFit(unitProfile(present), effectiveTactics));
}
