import { prisma } from "@/lib/prisma";
import { CURRENT_SEASON_START, ageAsOfJune30, liveCapHit } from "@/lib/finance";
import { loadLeagueCap } from "@/lib/free-agency-server";
import { findSimilarPlayers } from "./similarPlayers";

// UNHL Intelligence — "Contract & Market Intelligence" (Player Intelligence,
// phase 4 — see memory: gm-assistant-intelligence). Two explainable pieces,
// neither ever collapsed into a single verdict:
//  - Market Range: a min/p25/median/p75/max over the SAME comparables already
//    shown in Similar Players (real UNHL contracts, not an external guess),
//    with a stated confidence based on how many close comps exist and how
//    tight their cap hits actually are — never a single "he's worth $X".
//  - Risk view: age / remaining term / cap-share / expiring-soon shown as four
//    separate, real numbers with their own plain-stated threshold, not a
//    blended "risk score" — market value stays a reference, not a mandate.

export interface MarketRange {
  sampleSize: number;
  min: number; p25: number; median: number; p75: number; max: number;
  confidence: "high" | "medium" | "low";
  spreadRatio: number; // (max - min) / median — how wide the comps' cap hits actually are
  comps: { id: number; name: string; slug: string; capHit: number }[];
}

export interface ContractRiskFactor {
  key: "age" | "term" | "capShare" | "expiring";
  label: string;
  value: string;
  elevated: boolean;
}

export interface ContractIntelResult {
  playerId: number;
  capHit: number;
  contractYears: number;
  expiryYear: number;
  expiryStatus: "UFA" | "RFA";
  market: MarketRange | null;
  risk: ContractRiskFactor[];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Market range built from the exact comps Similar Players already surfaces
 *  (closest CK/PA/SC/DF-or-overall + age profile, real live cap hits) —
 *  confidence drops with a thin sample or a wide spread, both shown alongside
 *  the range rather than folded into it. */
async function marketRange(playerId: number): Promise<MarketRange | null> {
  const similar = await findSimilarPlayers(playerId, 8);
  if (!similar) return null;
  const withCap = similar.players.filter((p) => p.capHit > 0);
  if (withCap.length < 2) return null;

  const caps = withCap.map((p) => p.capHit).sort((a, b) => a - b);
  const median = percentile(caps, 0.5);
  const min = caps[0], max = caps[caps.length - 1];
  const spreadRatio = median > 0 ? (max - min) / median : 0;

  let confidence: MarketRange["confidence"] = caps.length >= 6 ? "high" : caps.length >= 4 ? "medium" : "low";
  if (spreadRatio > 1) confidence = confidence === "high" ? "medium" : "low"; // wide comps undercut a tight sample

  return {
    sampleSize: caps.length,
    min, p25: percentile(caps, 0.25), median, p75: percentile(caps, 0.75), max,
    confidence, spreadRatio: Math.round(spreadRatio * 100) / 100,
    comps: withCap.map((p) => ({ id: p.id, name: p.name, slug: p.slug, capHit: p.capHit })),
  };
}

// Plain, stated thresholds — not fitted, not hidden. Age: trade-value.ts's own
// ageFactor curve starts its steepest decline at 33+; 32 catches a player
// entering that zone while still under contract. Term: 5+ remaining years is
// a real long-term commitment. Cap share: 12% of the upper limit is the real
// NHL's rough "max-contract" territory. Expiring: 1 year or less left means a
// re-sign/UFA decision is coming up regardless of how the deal has aged.
const AGE_RISK = 32;
const TERM_RISK_YEARS = 5;
const CAP_SHARE_RISK = 0.12;
const EXPIRING_YEARS = 1;

export async function contractIntel(playerId: number): Promise<ContractIntelResult | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, age: true, birthDate: true, capHit: true, contractYears: true },
  });
  if (!player) return null;
  const contractYears = player.contractYears ?? 0;
  const capHit = liveCapHit(player);
  if (contractYears <= 0 || capHit <= 0) return null; // no active contract to assess

  const expiryYear = CURRENT_SEASON_START + contractYears;
  const ageAtExpiry = player.birthDate != null ? ageAsOfJune30(player.birthDate, expiryYear) : (player.age ?? 0) + contractYears;
  const expiryStatus: "UFA" | "RFA" = ageAtExpiry >= 27 ? "UFA" : "RFA";

  const [market, leagueCap] = await Promise.all([marketRange(playerId), loadLeagueCap()]);
  const capShare = leagueCap.upper > 0 ? capHit / leagueCap.upper : 0;

  const risk: ContractRiskFactor[] = [
    { key: "age", label: "Vek", value: `${player.age ?? "—"} rokov`, elevated: (player.age ?? 0) >= AGE_RISK },
    { key: "term", label: "Zostávajúca dĺžka", value: `${contractYears} ${contractYears === 1 ? "rok" : contractYears < 5 ? "roky" : "rokov"}`, elevated: contractYears >= TERM_RISK_YEARS },
    { key: "capShare", label: "Podiel na cape", value: `${(capShare * 100).toFixed(1)}%`, elevated: capShare >= CAP_SHARE_RISK },
    { key: "expiring", label: "Koniec zmluvy", value: `${expiryYear} (${expiryStatus})`, elevated: contractYears <= EXPIRING_YEARS },
  ];

  return { playerId, capHit, contractYears, expiryYear, expiryStatus, market, risk };
}
