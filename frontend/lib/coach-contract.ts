// Coach contracts — pure helpers (client-safe). A coach negotiates like a player:
// the better his ratings, the more he asks (higher salary, longer term, max 4 years).
// Firing pays out the WHOLE remaining contract (salary × years) from the club bank.

/** A coach's contract demand from his overall rating. Salary rounded to $50k. Max 4 yrs. */
export function coachDemand(overall: number | null | undefined): { salary: number; years: number } {
  const ov = overall ?? 70;
  const years = ov >= 85 ? 4 : ov >= 78 ? 3 : ov >= 71 ? 2 : 1;
  // ~$0.85M at ov60 → ~$6.1M at ov89; floor $0.75M
  const m = Math.max(0.75, (ov - 60) * 0.18 + 0.85);
  const salary = Math.round((m * 1_000_000) / 50_000) * 50_000;
  return { salary, years };
}

/** Buyout owed on firing = full remaining contract value (salary × years). */
export const coachBuyout = (salary: number | null | undefined, years: number | null | undefined) =>
  Math.max(0, Math.round(salary ?? 0)) * Math.max(0, Math.round(years ?? 0));
