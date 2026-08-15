// Derive a scouting-style player TYPE (Sniper, Playmaker, Grinder, Two-Way D…)
// from our own sim attributes. EliteProspects can't be scraped (403), and the sim
// already thinks in these terms (ratings.ts roleFitOf) — this is the per-player
// version for display on profiles. Ratings in this DB are compressed (~50-70).

export type TypeInput = {
  position?: string | null;
  isGoalie?: boolean;
  sc?: number | null; pa?: number | null; df?: number | null;
  ck?: number | null; st?: number | null; sk?: number | null;
  ag?: number | null; rb?: number | null; sz?: number | null; // goalie
};

const n = (v: number | null | undefined, d = 55) => (v == null ? d : v);
const isDefPos = (pos = "") => /(^|\/)D(\/|$)/.test(pos) || (pos.toUpperCase().includes("D") && !/[CW]/.test(pos.toUpperCase()));

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
  const phys = (C + T) / 2;

  if (isDefPos(p.position ?? "")) {
    if (off >= 68) return "Offensive Defenseman";
    if (off <= 60) return phys >= 74 ? "Stay-at-Home D" : "Defensive Defenseman";
    return "Two-Way Defenseman";
  }

  // forward
  if (off >= 62 && phys >= 73) return "Power Forward";     // real offense + big body
  if (phys >= 68 && off < 62) return "Grinder";            // physical, limited offense
  if (S - P >= 4) return "Sniper";
  if (P - S >= 4) return "Playmaker";
  if (D >= off - 2) return "Two-Way Forward";              // defense keeps pace with offense
  return "Scorer";
}
