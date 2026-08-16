// The clause "agent" — a deterministic (no-LLM) engine that decides whether a
// player with an NTC / NMC / M-NTC will accept a trade, and the WAIVER FEE his
// current club must pay him to consent. Real-CBA-like: a player waves his clause
// cheaply (or free) for a step UP — a bigger role and/or a better team — but
// demands a chunk of his remaining salary to accept a step DOWN, up to his full
// remaining money ("full payout") for a clear downgrade. The fee is paid by the
// player's CURRENT team out of its bank (he keeps getting his new salary too —
// effectively paid twice this season). NMC = the strongest protection, so he's
// the most reluctant (a stiffer fee). M-NTC = he only blocks the teams on his
// list; a move anywhere else is free.

export type ClauseType = "NTC" | "NMC" | "M_NTC";

export type ClauseVerdict = {
  clause: ClauseType;
  feePct: number;       // % of remaining salary the OLD team pays him to waive
  feeAmount: number;    // $ = feePct × remaining (rounded to 50k)
  fullPayout: boolean;  // he demands his entire remaining salary (100%)
  remaining: number;    // capHit × remaining years
  improvement: number;  // −1 (clear downgrade) … +1 (clear upgrade)
  reason: string;
};

export function clauseVerdict(input: {
  clause: ClauseType;
  capHit: number; contractYears: number;
  fromLine: number; toLine: number;           // projected lineup slot (1 = best)
  fromPointsPct: number; toPointsPct: number;  // standings strength, 0..1
  toTeamId: number; noTradeTeams: number[];
}): ClauseVerdict {
  const remaining = Math.max(0, (input.capHit || 0) * Math.max(1, input.contractYears || 1));
  const round50 = (n: number) => Math.round(n / 50_000) * 50_000;

  // situation delta: a lower line number on the new team is a better role; a
  // higher points% is a better team. Blend the two into −1..+1.
  const roleDelta = input.fromLine - input.toLine;                 // + = better role
  const standDelta = Math.max(-1, Math.min(1, (input.toPointsPct - input.fromPointsPct) * 2.5)); // + = better team
  const improvement = Math.max(-1, Math.min(1, 0.5 * (roleDelta / 3) + 0.5 * standDelta));

  const mk = (feePct: number, fullPayout: boolean, reason: string): ClauseVerdict => {
    feePct = Math.max(0, Math.min(100, Math.round(feePct)));
    if (fullPayout) feePct = 100;
    return { clause: input.clause, feePct, feeAmount: round50((feePct / 100) * remaining), fullPayout: feePct >= 100, remaining, improvement, reason };
  };

  // M-NTC: only the teams on his list are blocked; anywhere else he'll report free.
  if (input.clause === "M_NTC" && !input.noTradeTeams.includes(input.toTeamId))
    return mk(0, false, "This club isn't on his no-trade list — he'll report, no fee.");
  if (input.clause === "M_NTC")
    return mk(100, true, "He specifically listed this club as off-limits — only a full payout moves him.");

  // NTC / NMC: fee scales with how much the move sets him back.
  let feePct: number;
  if (improvement >= 0.1) feePct = 0;              // a step up → waives for nothing
  else if (improvement >= -0.1) feePct = 15;       // lateral → a token fee
  else feePct = 20 + (-improvement) * 100;         // a step down → scales toward 100
  if (input.clause === "NMC") feePct += 25;        // no-movement = the most reluctant
  const fullPayout = improvement <= -0.6;          // a clear downgrade → the whole cheque
  const reason = feePct <= 0
    ? "Happy with the move — waives his clause for free."
    : fullPayout
      ? "Won't accept the step down — demands his full remaining salary to waive."
      : `Will waive his ${input.clause === "NMC" ? "no-movement" : "no-trade"} clause for ${Math.min(100, Math.round(input.clause === "NMC" ? feePct : feePct))}% of his remaining salary.`;
  return mk(feePct, fullPayout, reason);
}
