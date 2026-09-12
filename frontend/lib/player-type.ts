// Derive a scouting-style player TYPE (Sniper, Playmaker, Grinder, Two-Way D…)
// from our own sim attributes. EliteProspects can't be scraped (403), and the sim
// already thinks in these terms (ratings.ts roleFitOf) — this is the per-player
// version for display on profiles. Ratings in this DB are compressed (~50-70).

import { AVG, OVERRIDE } from "./ratingBands";

export type TypeInput = {
  id?: number | null;
  position?: string | null;
  isGoalie?: boolean;
  sc?: number | null; pa?: number | null; df?: number | null;
  ck?: number | null; st?: number | null; sk?: number | null; ph?: number | null;
  ag?: number | null; rb?: number | null; sz?: number | null; // goalie
};

const n = (v: number | null | undefined, d = 55) => (v == null ? d : v);
const isDefPos = (pos = "") => /(^|\/)D(\/|$)/.test(pos) || (pos.toUpperCase().includes("D") && !/[CW]/.test(pos.toUpperCase()));

// A D's offense needs to be MEANINGFULLY above his position's league-average
// PA/SC (lib/ratingBands.ts's AVG.D, ~44-48 here) to count as "decent" for the
// Two-Way check below — a couple points over average (ratingBands.ts's own
// green colouring bar) isn't enough to separate a real two-way blueliner from
// a shutdown defenseman who just happens to clear the green threshold too.
const D_OFF_TWO_WAY = Math.max(AVG.D.pa, AVG.D.sc) + 10;

// Hand-picked "Elite" tier overrides, from the commissioner's own external
// rating-scale review (unhl-player-types-roles-formulas-v6.xlsx, "Role
// Classification" sheet). These 8 players' compressed attributes in this DB
// still clear the algorithmic thresholds above, but are explicitly called out
// as the league's true top tier — keyed by DB id (not name) since several of
// these players' name field carries a captaincy suffix, e.g. "''C'' (NTC)".
const ELITE_OVERRIDE: Record<number, string> = {
  584: "Elite Forward",    // Connor McDavid
  585: "Elite Forward",    // Leon Draisaitl
  1041: "Elite Forward",   // Nathan MacKinnon
  673: "Elite Forward",    // Macklin Celebrini
  512: "Elite Forward",    // Nikita Kucherov
  489: "Elite Defenseman", // Cale Makar
  1121: "Elite Defenseman",// Evan Bouchard
  878: "Elite Defenseman", // Zach Werenski
};

/** A short player-type label, or null if there aren't enough ratings. */
export function playerType(p: TypeInput): string | null {
  if (p.id != null && ELITE_OVERRIDE[p.id]) return ELITE_OVERRIDE[p.id];
  if (p.isGoalie || p.position === "G") {
    const ag = p.ag, rb = p.rb, sz = p.sz;
    if (ag == null && rb == null && sz == null) return "Goaltender";
    if (n(ag) >= n(sz) + 3 && n(ag) >= n(rb)) return "Athletic Goalie";
    if (n(sz) >= n(ag) + 3 || n(rb) >= n(ag) + 3) return "Positional Goalie";
    return "Hybrid Goalie";
  }

  const sc = p.sc, pa = p.pa, df = p.df, ck = p.ck, st = p.st;
  if (sc == null && pa == null && df == null) return null;

  // NB: DF is high across all decent players in this rating set, so type is driven
  // by OFFENSE level (SC/PA) and PHYSICALITY (CK/ST), not offense-vs-defense.
  const S = n(sc), P = n(pa), D = n(df), C = n(ck), T = n(st);
  const SK = n(p.sk), PH = n(p.ph);
  const paSc = P + S;
  const off = Math.max(S, P);
  // physicality is a CHECKING trait (CK), not raw strength — a strong but skilled
  // winger (high ST) shouldn't read as a grinder, so ST only lightly contributes.
  const phys = C * 0.75 + T * 0.25;

  if (isDefPos(p.position ?? "")) {
    // RAW THRESHOLD RULES first (unhl-player-types-roles-formulas-v6.xlsx's "Role
    // Rules" sheet, "Raw thresholds" tier — exact fixed cutoffs on PA+SC/DF/SK).
    if (paSc >= 105 && D < 78) return "Offensive D";
    if (paSc >= 105 && D >= 78) return "Two-Way D";
    if (SK >= 40 && P >= 53 && paSc < 105 && D >= 78) return "Defensive D";
    if (P < 53 && paSc < 105 && D >= 78) return "Stay-at-Home D";

    // Percentile-fallback tier (approximated via league-average-relative
    // comparison, since true percentile ranks need a league-wide DB query this
    // per-player function doesn't have access to): "decent at both ends" means
    // offense meaningfully above the D-position average (D_OFF_TWO_WAY) AND
    // defense clearly above the DF average — not just "not weak enough to be
    // Offensive", so a genuine two-way blueliner (e.g. Ekholm: PA 60, DF 79)
    // reads as Two-Way instead of falling into Stay-at-Home purely because his
    // offense sits below the 68 Offensive-D cutoff. A pure shutdown D (e.g. PA
    // low-50s, still DF-strong) stays below D_OFF_TWO_WAY and keeps reading as
    // Stay-at-Home/Defensive, same as before.
    const defGood = D >= OVERRIDE.D.df.y;
    if (off >= 68) return "Offensive D";
    if (off >= D_OFF_TWO_WAY && defGood) return "Two-Way D";
    if (off <= 60) return phys >= 74 ? "Stay-at-Home D" : "Defensive D";
    return "Two-Way D";
  }

  // forward — RAW THRESHOLD RULES first, exactly as the Role Rules sheet specifies
  // (checked in the sheet's own row order; each combination of PA/SC/PA+SC/DF
  // below matches at most one rule, so order only matters where a player fails
  // Dual-Threat's SK/PH bar despite clearing its PA/SC bar).
  if (SK >= 62 && PH >= 65 && P >= 60 && S >= 60 && paSc >= 125) return "Dual-Threat";
  if (P < 60 && S >= 66) return "Sniper";
  if (P >= 66 && S < 60) return "Playmaker";
  if (P < 66 && S < 66 && paSc >= 110 && paSc < 125) return D >= 69 ? "Two-Way Forward" : "Offensive Forward";
  if (P < 66 && S < 66 && paSc < 110 && D >= 69) return "Defensive Forward";
  if (C >= 75 && paSc < 110 && D < 69) return "Forechecker / Grinder";

  // Percentile-fallback tier (approximated via league-average-relative deltas,
  // since true percentile ranks need a league-wide DB query this per-player
  // function doesn't have access to — see the sheet's own note: "Two-Way
  // special condition first; then specialist defensive/grinder rule; then
  // offense-vs-defense comparison"). Compare each attribute against ITS OWN
  // league-average for forwards (AVG.F), not the raw values: CK averages ~66
  // and DF ~63 here while SC/PA average only ~49, so comparing raw values let
  // CK/DF dominate regardless of whether a player was actually above his OWN
  // attribute's average.
  const avgF = AVG.F;
  const sRel = S - avgF.sc, pRel = P - avgF.pa, cRel = C - avgF.ck, dRel = D - avgF.df;
  const offSumRel = sRel + pRel; // proxy for (PA+SC) percentile

  if (offSumRel > 2 * cRel && Math.abs(2 * dRel - offSumRel) <= 8) return "Two-Way Forward";
  if (2 * cRel > offSumRel && cRel > dRel) return "Forechecker / Grinder";
  return offSumRel > cRel + dRel ? "Offensive Forward" : "Defensive Forward";
}
