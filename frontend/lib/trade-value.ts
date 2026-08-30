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

// Draft-pick trade value by absolute draft slot (1 = 1st overall, N+1 = 2nd-round
// first pick, etc — see slotOfPick in trades/build/actions.ts). A single smooth
// exponential decay (base 1000, decay 60 — the decay was already widened once
// from 42 on user feedback that rounds 2-3 traded too cheap) left the very TOP of
// the draft badly undervalued: #1 overall landed at just ~983, well under even a
// modest veteran's playerValue (a 70 OV/27yo depth player is already 1225). User
// feedback (2026-08-30): a 1st overall pick should trade like a good player
// already in the league, and the whole top-10 should sit near that level, not
// just #1 — the values need real graduation, not a flat top-of-round-1.
// Added a front-loaded "elite" premium (a Gaussian bump centred on #1, ~10 picks
// wide) on top of the untouched base curve: it dominates picks 1-10, fades to a
// small nudge by the middle of round 1, and is negligible (<1) by pick 25 — so
// rounds 2+ (the part already tuned to prior feedback) are unaffected.
// Reference points: #1 ≈ 2583, #5 ≈ 2284, #10 ≈ 1558, #16 ≈ 938 (was 766),
// R1 end (~#32) ≈ 589 (was 587, essentially unchanged), R2 ≈ 344-577 (unchanged),
// R3 ≈ 202-338 (unchanged) — compare a good veteran (85 OV/27yo) at 2500.
const PICK_BASE = 1000, PICK_DECAY = 60;
const PICK_ELITE = 1600, PICK_ELITE_WIDTH = 10;
export const pickValueBySlot = (slot: number): number => {
  const base = PICK_BASE * Math.exp(-slot / PICK_DECAY);
  const elite = PICK_ELITE * Math.exp(-(((slot - 1) / PICK_ELITE_WIDTH) ** 2));
  return Math.round(base + elite);
};
