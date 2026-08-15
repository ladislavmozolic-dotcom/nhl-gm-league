// Entry-Level Contract (ELC) auto-formula — ProfiNHL rules.
//
// An ELC = base salary + a performance bonus (added to the base and fixed for the
// whole term), with term set by age. The bonus comes from the player's LAST real
// season (points-per-game for skaters, DF/PK for D — the higher of the two, SV%
// for goalies) and only counts if he played enough (≥40 GP skater / ≥15 goalie).

export type ElcPos = "F" | "D" | "G";

/** Term by age at signing: 18-21 → 3yr, 22-23 → 2yr, 24+ → 1yr. */
export function elcTerm(age: number | null | undefined): number {
  const a = age ?? 22;
  if (a <= 21) return 3;
  if (a <= 23) return 2;
  return 1;
}

// We don't track draft position, so every ELC carries the flat base and earns
// its money through the performance bonus.
export const ELC_BASE = 900_000;
const MIN_GP_CONTRACT = 10; // fewer than this last season → not signed to an ELC yet
const MIN_GP_SKATER = 40;   // bonus threshold for skaters
const MIN_GP_GOALIE = 15;   // bonus threshold for goalies

/** Forward performance bonus by points-per-game. */
export function elcForwardBonus(ppg: number): number {
  if (ppg >= 0.9) return 2_100_000;
  if (ppg >= 0.8) return 1_700_000;
  if (ppg >= 0.7) return 1_300_000;
  if (ppg >= 0.6) return 900_000;
  if (ppg >= 0.5) return 600_000;
  if (ppg >= 0.4) return 300_000;
  return 0;
}

/** Defenseman bonus — the HIGHER of his points-per-game bonus and his DF/PK bonus. */
export function elcDefensePointsBonus(ppg: number): number {
  if (ppg >= 0.6) return 1_500_000;
  if (ppg >= 0.5) return 1_200_000;
  if (ppg >= 0.4) return 900_000;
  if (ppg >= 0.3) return 600_000;
  if (ppg >= 0.2) return 300_000;
  return 0;
}
export function elcDefenseDfBonus(df: number | null | undefined): number {
  const d = df ?? 0;
  if (d >= 82) return 1_200_000;
  if (d >= 80) return 900_000;
  if (d >= 78) return 600_000;
  if (d >= 76) return 300_000;
  return 0;
}
export function elcDefenseBonus(ppg: number, df: number | null | undefined): number {
  return Math.max(elcDefensePointsBonus(ppg), elcDefenseDfBonus(df));
}

/** Goalie bonus by save percentage (as a fraction, e.g. 0.921). */
export function elcGoalieBonus(svPct: number): number {
  if (svPct >= 0.925) return 900_000;
  if (svPct >= 0.915) return 600_000;
  if (svPct >= 0.905) return 300_000;
  return 0;
}

export type ElcInput = {
  pos: ElcPos; age: number | null; df?: number | null;
  lastSeasonGP?: number | null; lastSeasonPts?: number | null; lastSeasonSvPct?: number | null;
};
export type ElcContract = { base: number; bonus: number; capHit: number; years: number; ppg: number | null; bonusEligible: boolean; eligible: boolean };

export function computeELC(p: ElcInput): ElcContract {
  const years = elcTerm(p.age);
  const base = ELC_BASE;
  const gp = p.lastSeasonGP ?? 0;
  const ppg = p.pos !== "G" && gp > 0 ? (p.lastSeasonPts ?? 0) / gp : null;

  const eligible = gp >= MIN_GP_CONTRACT;                                  // ≥10 GP → gets a contract
  const bonusEligible = p.pos === "G" ? gp >= MIN_GP_GOALIE : gp >= MIN_GP_SKATER; // ≥40 GP (15 goalie) → bonus
  let bonus = 0;
  if (bonusEligible) {
    if (p.pos === "F") bonus = elcForwardBonus(ppg ?? 0);
    else if (p.pos === "D") bonus = elcDefenseBonus(ppg ?? 0, p.df);
    else bonus = elcGoalieBonus(p.lastSeasonSvPct ?? 0);
  }
  return { base, bonus, capHit: base + bonus, years, ppg, bonusEligible, eligible };
}
