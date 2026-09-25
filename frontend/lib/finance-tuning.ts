// Commissioner-tunable Detailed-Finance revenue constants (admin ▸ Simulation ▸
// Finance). Defaults are the original first-pass values, so an untouched league
// computes exactly what it did before these became editable. Pure — no DB.

export type FinanceTuning = {
  jerseyNet: number;              // club's net $ per jersey sold
  jerseyScale: number;            // jerseys a Star-Power-100 player would sell in a season
  apparelBase: number;            // apparel $ at neutral fan heat
  otherBase: number;              // other-goods $ at neutral fan heat
  tradeBoostPct: number;          // jersey spike for a newly acquired player, % on day 0
  tradeBoostHalfLifeDays: number; // days for that spike to halve
  playoffSeatBase: number;        // playoff $/seat before the per-round climb
  playoffSeatPerRound: number;    // + $/seat each round deeper
  playoffMerchPerRoundPct: number;// merch uplift % per playoff round reached
  sponsorBase: number;            // weakest brand's sponsor AAV
  sponsorRange: number;           // + this much at full brand strength
};

export const DEFAULT_FINANCE_TUNING: FinanceTuning = {
  jerseyNet: 120, jerseyScale: 40_000, apparelBase: 3_200_000, otherBase: 1_400_000,
  tradeBoostPct: 60, tradeBoostHalfLifeDays: 21,
  playoffSeatBase: 65, playoffSeatPerRound: 22, playoffMerchPerRoundPct: 7,
  sponsorBase: 5_000_000, sponsorRange: 8_000_000,
};

/** Map the flat `fin*` EngineSettings keys onto a FinanceTuning. */
export function financeTuningFrom(s: Partial<Record<string, unknown>> | null | undefined): FinanceTuning {
  const n = (k: string, d: number) => (typeof s?.[k] === "number" && Number.isFinite(s[k] as number) ? (s[k] as number) : d);
  const D = DEFAULT_FINANCE_TUNING;
  return {
    jerseyNet: n("finJerseyNet", D.jerseyNet), jerseyScale: n("finJerseyScale", D.jerseyScale),
    apparelBase: n("finApparelBase", D.apparelBase), otherBase: n("finOtherBase", D.otherBase),
    tradeBoostPct: n("finTradeBoostPct", D.tradeBoostPct), tradeBoostHalfLifeDays: Math.max(1, n("finTradeBoostHalfLife", D.tradeBoostHalfLifeDays)),
    playoffSeatBase: n("finPlayoffSeatBase", D.playoffSeatBase), playoffSeatPerRound: n("finPlayoffSeatPerRound", D.playoffSeatPerRound),
    playoffMerchPerRoundPct: n("finPlayoffMerchPct", D.playoffMerchPerRoundPct),
    sponsorBase: n("finSponsorBase", D.sponsorBase), sponsorRange: n("finSponsorRange", D.sponsorRange),
  };
}

/** Jersey multiplier for a player `days` after he arrived by trade: a spike
 *  that halves every `tradeBoostHalfLifeDays` (first-month hype, then decay). */
export function tradeJerseyBoost(days: number | null | undefined, t: FinanceTuning = DEFAULT_FINANCE_TUNING): number {
  if (days == null || days < 0) return 1;
  return 1 + (t.tradeBoostPct / 100) * Math.pow(0.5, days / t.tradeBoostHalfLifeDays);
}
