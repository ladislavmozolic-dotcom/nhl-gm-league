// Star Power — a player's business / media value, computed automatically. It has
// ZERO effect on the ice: it drives merchandise, jersey sales, fan interest, ticket
// demand and sponsor appeal only. A 36-year-old franchise legend can still be a
// Superstar in jersey sales after his on-ice game has faded; a 19-year-old #1 pick
// can carry huge hype before he has any NHL production.
//
// Pure — no DB. The server gathers the season/award inputs and calls this.

export type StarTier = "Unknown" | "Recognized" | "Star" | "Elite Star" | "Superstar";

export type StarPowerInput = {
  overall: number | null;
  age: number | null;
  isGoalie: boolean;
  lastSeasonPts: number | null;
  lastSeasonGP: number | null;
  lastSeasonSvPct?: number | null; // goalies
  careerPoints?: number | null;    // sum of regular-season points across seasons (skaters)
  careerGP?: number | null;
  awardPoints?: number;            // weighted prestige of career awards (see AWARD_PRESTIGE)
};

// Prestige weight per award category — how much a trophy adds to fame.
export const AWARD_PRESTIGE: Record<string, number> = {
  Hart: 6, "Conn Smythe": 6, "Art Ross": 5, Norris: 5, Vezina: 5,
  "Rocket Richard": 4, Calder: 3, Presidents: 2,
};

export function awardPrestige(category: string): number {
  return AWARD_PRESTIGE[category] ?? 2;
}

export type StarBreakdown = { talent: number; production: number; career: number; awards: number; hype: number };

/** Star Power 0–100 with its tier and the component breakdown (for "main reasons"). */
export function starPower(i: StarPowerInput): { score: number; tier: StarTier; parts: StarBreakdown } {
  const ovr = i.overall ?? 60;
  // talent — the on-ice rating, position-relative (skaters and goalies sit on
  // different overall bands in this league; anchor each to its own top) (0..48)
  const [lo, hi] = i.isGoalie ? [68, 82] : [55, 70];
  const talent = clamp((ovr - lo) / (hi - lo), 0, 1) * 48;

  // production — recent output people actually watch; the real star separator (0..30)
  let production = 0;
  if (i.isGoalie) {
    const sv = i.lastSeasonSvPct ?? 0;
    if (sv > 0) production = clamp((sv - 0.9) / (0.930 - 0.9), 0, 1) * 30;
    else production = talent * 0.25; // no sv data → lean on rating
  } else {
    const gp = i.lastSeasonGP ?? 0;
    const ppg = gp > 0 ? (i.lastSeasonPts ?? 0) / gp : 0;
    production = clamp(ppg / 1.2, 0, 1) * 30;
  }

  // career fame — accumulated legend (0..10)
  const career = clamp((i.careerPoints ?? 0) / 300, 0, 1) * 10;

  // awards — trophies carry lasting star status (0..20)
  const awards = clamp(i.awardPoints ?? 0, 0, 20);

  // rookie / prospect hype — youth + high ceiling before the production arrives (0..14)
  const hypeAnchor = i.isGoalie ? 74 : 62;
  const hype = (i.age ?? 30) <= 21 ? clamp((ovr - hypeAnchor) / 8, 0, 1) * 14 : 0;

  const score = Math.round(clamp(talent + production + career + awards + hype, 0, 100));
  return { score, tier: tierFor(score), parts: { talent, production, career, awards, hype } };
}

export function tierFor(score: number): StarTier {
  if (score >= 85) return "Superstar";
  if (score >= 70) return "Elite Star";
  if (score >= 55) return "Star";
  if (score >= 35) return "Recognized";
  return "Unknown";
}

export function tierAccent(tier: StarTier): string {
  switch (tier) {
    case "Superstar": return "text-fuchsia-300";
    case "Elite Star": return "text-amber-300";
    case "Star": return "text-sky-300";
    case "Recognized": return "text-emerald-300";
    default: return "text-slate-400";
  }
}

/** Human "main reasons" for a star-power value — the biggest contributors first. */
export function starReasons(parts: StarBreakdown): string[] {
  const labels: [keyof StarBreakdown, string][] = [
    ["talent", "Elite on-ice talent"],
    ["production", "Big offensive production"],
    ["awards", "Trophy pedigree"],
    ["career", "Career legend status"],
    ["hype", "Rookie hype"],
  ];
  return labels
    .filter(([k]) => parts[k] >= 4)
    .sort((a, b) => parts[b[0]] - parts[a[0]])
    .map(([, l]) => l)
    .slice(0, 3);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
