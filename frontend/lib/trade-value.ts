// Shared player trade-value heuristic (used by GM Assist and the AI GM). We have no
// potential rating for rostered players, so the age curve is a rough "future value"
// proxy: a young player projects to grow, an ageing one to decline. Because value is
// OV², a young player who's ALREADY good becomes a franchise-building asset — worth far
// more than a veteran at the same OV.
// Real roster data check (2026-08-30): rookie-aged (≤22) players sit at a median
// overall of just ~50 — (overall-35)² is tiny there (225), and the old 1.45x cap
// couldn't compensate. A median rookie (348) landed well below a median SCOUTED
// prospect of comparable real upside (~549, prospectValueByPot in trades/build/
// actions.ts) — GM Assist was systematically undervaluing rookies vs. equivalent
// prospects for no real-hockey reason. Widened the young end so a median rookie
// (~529) lines up with a median prospect; 26+ (established, no longer projecting
// growth) is unchanged.
export const ageFactor = (age: number | null): number => {
  const a = age ?? 27;
  return a <= 20 ? 2.2 : a <= 21 ? 1.9 : a <= 22 ? 1.6 : a <= 23 ? 1.35
    : a <= 25 ? 1.1 : a <= 28 ? 1.0 : a <= 30 ? 0.9 : a <= 32 ? 0.8 : a <= 34 ? 0.7 : 0.6;
};

export const playerValue = (overall: number, age: number | null): number =>
  Math.round(Math.pow(Math.max(1, overall - 35), 2) * ageFactor(age));
