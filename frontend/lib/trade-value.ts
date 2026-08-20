// Shared player trade-value heuristic (used by GM Assist and the AI GM). We have no
// potential rating for rostered players, so the age curve is a rough "future value"
// proxy: a young player projects to grow, an ageing one to decline. Because value is
// OV², a young player who's ALREADY good becomes a franchise-building asset — worth far
// more than a veteran at the same OV.
export const ageFactor = (age: number | null): number => {
  const a = age ?? 27;
  return a <= 20 ? 1.45 : a <= 21 ? 1.35 : a <= 22 ? 1.26 : a <= 23 ? 1.18
    : a <= 25 ? 1.06 : a <= 28 ? 1.0 : a <= 30 ? 0.9 : a <= 32 ? 0.8 : a <= 34 ? 0.7 : 0.6;
};

export const playerValue = (overall: number, age: number | null): number =>
  Math.round(Math.pow(Math.max(1, overall - 35), 2) * ageFactor(age));
