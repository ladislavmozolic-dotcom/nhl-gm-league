// Derive a scouting-style player TYPE (Sniper, Playmaker, Grinder, Two-Way D…)
// from our own sim attributes. EliteProspects can't be scraped (403), and the sim
// already thinks in these terms (ratings.ts roleFitOf) — this is the per-player
// version for display on profiles. Ratings in this DB are compressed (~50-70).

import { AVG, OVERRIDE } from "./ratingBands";

export type TypeInput = {
  position?: string | null;
  isGoalie?: boolean;
  sc?: number | null; pa?: number | null; df?: number | null;
  ck?: number | null; st?: number | null; sk?: number | null;
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

/** A short player-type label, or null if there aren't enough ratings. */
export function playerType(p: TypeInput): string | null {
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
  const off = Math.max(S, P);
  // physicality is a CHECKING trait (CK), not raw strength — a strong but skilled
  // winger (high ST) shouldn't read as a grinder, so ST only lightly contributes.
  const phys = C * 0.75 + T * 0.25;

  if (isDefPos(p.position ?? "")) {
    // "decent at both ends": offense meaningfully above the D-position average
    // (D_OFF_TWO_WAY) AND defense clearly above the DF average — not just "not
    // weak enough to be Offensive", so a genuine two-way blueliner (e.g. Ekholm:
    // PA 60, DF 79) reads as Two-Way instead of falling into Stay-at-Home purely
    // because his offense sits below the 68 Offensive-D cutoff. A pure shutdown
    // D (e.g. PA low-50s, still DF-strong) stays below D_OFF_TWO_WAY and keeps
    // reading as Stay-at-Home/Defensive, same as before.
    const defGood = D >= OVERRIDE.D.df.y;
    if (off >= 68) return "Offensive Defenseman";
    if (off >= D_OFF_TWO_WAY && defGood) return "Two-Way Defenseman";
    if (off <= 60) return phys >= 74 ? "Stay-at-Home D" : "Defensive Defenseman";
    return "Two-Way Defenseman";
  }

  // forward — compare each attribute against ITS OWN league-average for forwards
  // (AVG.F) before combining/comparing, not the raw values: CK averages ~66 and
  // DF ~63 here while SC/PA average only ~49, so comparing raw values (as this
  // used to) let CK/DF dominate regardless of whether a player was actually
  // above his OWN attribute's average — a pure scorer with merely AVERAGE
  // defense (DF == avg) used to still read as "defense keeps pace with
  // offense" just because DF's raw average already sits above SC/PA's.
  const avgF = AVG.F;
  const offRel = Math.max(S - avgF.sc, P - avgF.pa);
  const physRel = (C - avgF.ck) * 0.75 + (T - avgF.st) * 0.25;
  const dRel = D - avgF.df;

  if (offRel >= 13 && physRel >= 4) return "Power Forward";  // real offense + big body
  if (physRel >= -1 && offRel < 13) return "Grinder";        // physical, limited offense
  if (S - P >= 4) return "Sniper";
  if (P - S >= 4) return "Playmaker";
  if (dRel >= offRel - 2) return "Two-Way Forward";          // defense keeps pace with offense
  return "Scorer";
}
