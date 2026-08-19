// Arena ticket pricing (STHS-style): the arena is split into Level 1-4 + Luxury
// sections, each with a capacity and a ticket price. Capacity is derived from
// the team's real arena capacity; the GM sets prices.

export type ArenaSection = { level: string; capacity: number; price: number };

const LEVELS = ["Level 1", "Level 2", "Level 3", "Level 4", "Luxury"];
const SPLIT = [0.374, 0.197, 0.262, 0.098, 0.069]; // proportions of total capacity
const DEFAULT_PRICE = [175, 105, 60, 45, 350];     // tuned so a full house ≈ $2M/game

export function defaultSections(capacity: number | null): ArenaSection[] {
  const total = capacity && capacity > 0 ? capacity : 18000;
  return LEVELS.map((level, i) => ({
    level, capacity: Math.round(total * SPLIT[i]), price: DEFAULT_PRICE[i],
  }));
}

export function getArenaSections(team: { capacity: number | null; arenaSections: unknown }): ArenaSection[] {
  const stored = team.arenaSections as ArenaSection[] | null;
  if (Array.isArray(stored) && stored.length === LEVELS.length) return stored;
  return defaultSections(team.capacity);
}

/** Estimated revenue from a sellout at the current prices (for display). */
export function selloutRevenue(sections: ArenaSection[]): number {
  return sections.reduce((t, s) => t + s.capacity * s.price, 0);
}

// ---- salary cap ------------------------------------------------------------

export const CURRENT_SEASON_START = 2026; // 2026-27
export const seasonLabel = (startYear: number) =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;

export type CapPlayer = { capHit: number | null; contractYears: number | null; age: number | null };

/** Per-year cap for a player over `span` seasons: salary while under contract,
 *  then a UFA/RFA marker the season it expires (UFA if 27+ at expiry). */
export function playerCapYears(p: CapPlayer, startYear = CURRENT_SEASON_START, span = 8) {
  const years = p.contractYears ?? 0;
  const out: Array<{ year: string; salary: number | null; status: "UFA" | "RFA" | null }> = [];
  for (let i = 0; i < span; i++) {
    const label = seasonLabel(startYear + i);
    if (i < years) out.push({ year: label, salary: p.capHit ?? 0, status: null });
    else if (i === years) {
      const ageAtExpiry = (p.age ?? 0) + i;
      out.push({ year: label, salary: null, status: ageAtExpiry >= 27 ? "UFA" : "RFA" });
    } else out.push({ year: label, salary: null, status: null });
  }
  return out;
}

export type CapSummary = {
  totalSalaries: number; retainsBuyouts: number; capHit: number; capSpace: number;
  upper: number; lower: number; overCap: boolean;
};

export function teamCapSummary(
  players: Array<{ capHit: number | null }>,
  cap: { salaryCapUpper: number; salaryCapLower: number },
  retainsBuyouts = 0, // dead money from buyouts/retentions counting this season
): CapSummary {
  const totalSalaries = players.reduce((t, p) => t + (p.capHit ?? 0), 0);
  const capHit = totalSalaries + retainsBuyouts;
  return {
    totalSalaries, retainsBuyouts, capHit, capSpace: cap.salaryCapUpper - capHit,
    upper: cap.salaryCapUpper, lower: cap.salaryCapLower, overCap: capHit > cap.salaryCapUpper,
  };
}

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export const SEASON_GAMES = 82;

// NHL-style off-season cushion: a club may sit up to 10% over the upper limit
// through the summer, but must be cap-compliant by regular-season opening day.
export const OFFSEASON_CUSHION = 0.10;
export function capCeilingForPhase(upper: number, phase: string): number {
  return phase === "regular" || phase === "playoffs" ? upper : Math.round(upper * (1 + OFFSEASON_CUSHION));
}

// LTIR: a skater whose injury has driven his CON below 90 goes on Long-Term
// Injured Reserve — his cap hit becomes relief, so the club may exceed the cap
// by that amount to call up a replacement (like the real NHL). CON ≥ 90 (short
// day-to-day) gives no relief. Goalies excluded (their CON isn't injury-based).
export const LTIR_CON = 90;
type LtirPlayer = { capHit: number | null; injuryDaysLeft?: number | null; condition?: number | null; isGoalie?: boolean };
export function onLtir(p: LtirPlayer): boolean {
  return !p.isGoalie && (p.injuryDaysLeft ?? 0) > 0 && (p.condition ?? 100) < LTIR_CON;
}
export function ltirRelief(players: LtirPlayer[]): number {
  return players.reduce((s, p) => s + (onLtir(p) ? (p.capHit ?? 0) : 0), 0);
}

/**
 * In-season ACCRUED ("Actual") cap space, per the league's cap calculator:
 * unused cap banks every game, so a club that sits under the ceiling early can
 * carry more than the ceiling later (a pricier deadline addition is fine because
 * of the saved space). Derivation from the sheet:
 *   maxCapHit = (games×ceiling − capHit×played) / (games − played)   [DY3]
 *   actual space = maxCapHit − capHit  =  games × (ceiling − capHit) / (games − played)
 * So a team $1M under after 10 of 82 games has 82×1M/72 ≈ $1.14M; by the
 * deadline the same $1M is worth far more (fewer games to prorate it over).
 * `annualSpace` is (ceiling − capHit). Returns the accrued space and the max
 * cap hit the club may carry for the rest of the season.
 */
export function accruedCapSpace(annualSpace: number, gamesPlayed: number, gamesTotal = SEASON_GAMES) {
  const played = Math.max(0, Math.round(gamesPlayed));
  const remaining = gamesTotal - played;
  if (remaining <= 0) return { actual: annualSpace, remaining: 0, played }; // season over — no games left to accrue over
  const actual = (annualSpace * gamesTotal) / remaining;
  return { actual, remaining, played };
}

export type BuyoutLine = { perYear: number; startYear: number; years: number };
/** Dead money from buyouts/retentions that counts against the cap in `year`. */
export function deadMoneyForYear(buyouts: BuyoutLine[], year: number): number {
  return buyouts.reduce((t, b) => t + (year >= b.startYear && year < b.startYear + b.years ? b.perYear : 0), 0);
}

export type CapCentralRow = {
  count: number; totalSalaries: number; retainsBuyouts: number;
  capHit: number; capSpace: number; projCapHit: number; projCapSpace: number;
  underFloorBy: number; // $ short of the lower limit (0 if at/above the floor)
};

/**
 * A CapCentral row matching the league's Cap Central:
 *   Total Salaries      = Σ full annual cap hits of the NHL roster
 *   Retains & Buyouts   = dead-money / retention adjustment (counts into the cap)
 *   Actual Cap Hit      = Total Salaries + Retains & Buyouts
 *   Actual Cap Space    = ceiling − Actual Cap Hit  (current, can be negative)
 *   Projected Cap Space = the biggest FULL-SEASON cap hit a club can still add and
 *                         stay legal — unused cap banks each game, so it grows
 *                         toward the deadline. = gamesTotal × (ceiling − capHit) ÷
 *                         gamesRemaining. (e.g. $1M under at game 60 → $3.7M.)
 *   Projected Cap Hit    = the max total cap hit a club may carry for the rest of
 *                         the season = Actual Cap Hit + Projected Cap Space.
 * gamesTotal comes from the actual schedule (82/84…); gamesPlayed from standings.
 */
export function teamCapCentral(
  players: Array<{ capHit: number | null }>,
  retainsBuyouts: number, // net retention / buyout adjustment (± dollars) from the team record
  cap: { salaryCapUpper: number; salaryCapLower?: number },
  opts: { gamesPlayed?: number; gamesTotal?: number } = {},
): CapCentralRow {
  const gamesTotal = opts.gamesTotal ?? SEASON_GAMES;
  const totalSalaries = players.reduce((t, p) => t + (p.capHit ?? 0), 0);
  const capHit = totalSalaries + retainsBuyouts;
  const capSpace = cap.salaryCapUpper - capHit;
  const underFloorBy = Math.max(0, (cap.salaryCapLower ?? 0) - capHit);
  const projCapSpace = accruedCapSpace(capSpace, opts.gamesPlayed ?? 0, gamesTotal).actual;
  return {
    count: players.length, totalSalaries, retainsBuyouts, capHit,
    capSpace, underFloorBy,
    projCapHit: capHit + projCapSpace, // max cap hit the club may carry for the rest
    projCapSpace,
  };
}

// ---- team finance model ----------------------------------------------------

export const STARTING_BANK = 50_000_000;
export const HOME_GAMES = 42;   // per NHL team
export const TOTAL_GAMES = 84;

/**
 * Attendance draw (0.5..1.0). Higher popularity and a winning record fill the
 * building; an unpopular, losing team draws fewer fans (less ticket revenue).
 */
export function attendanceRate(popularity: number, pointsPct: number): number {
  // Market POPULARITY is the dominant driver — a hockey mecca (Montreal, Toronto…)
  // packs the building nearly every night regardless of the standings, while a soft
  // market lives and dies by the record. Record still matters, just less than market.
  const raw = 0.85 + (popularity - 100) / 100 * 0.7 + (pointsPct - 0.5) * 0.35;
  return Math.max(0.6, Math.min(1.0, raw));
}

// ---- buyouts ("vyplatený zo zmluvy") ---------------------------------------

/**
 * Buyout terms: dead-money cap hit = buyout% of salary, spread over 2× the
 * remaining contract years; the same total is debited from the team bank.
 */
export function buyoutTerms(
  salary: number, remainingYears: number, inSeason: boolean,
  cfg: { buyoutPctSeason: number; buyoutPctOffseason: number },
) {
  const pct = inSeason ? cfg.buyoutPctSeason : cfg.buyoutPctOffseason;
  const perYear = Math.round((salary * pct / 100) / 50000) * 50000; // multiple of 50K
  const years = Math.max(1, remainingYears * 2);
  return { perYear, years, totalCost: perYear * years, pct };
}

export type TeamFinance = {
  popularity: number; attendance: number;
  actualIncome: number; projectedIncome: number;
  actualExpenses: number; projectedExpenses: number;
  projectedResult: number; bankAccount: number; projectedBankAccount: number;
};

export function computeTeamFinance(input: {
  popularity: number; pointsPct: number; selloutRevenue: number; salary: number;
  homeGamesPlayed: number; totalGamesPlayed: number; startingBank?: number;
}): TeamFinance {
  const start = input.startingBank ?? STARTING_BANK;
  const attendance = attendanceRate(input.popularity, input.pointsPct);
  const perGame = attendance * input.selloutRevenue;
  const actualIncome = input.homeGamesPlayed * perGame;
  const projectedIncome = HOME_GAMES * perGame;
  const actualExpenses = input.salary * (input.totalGamesPlayed / TOTAL_GAMES);
  const projectedExpenses = input.salary;
  return {
    popularity: input.popularity, attendance,
    actualIncome, projectedIncome, actualExpenses, projectedExpenses,
    projectedResult: projectedIncome - projectedExpenses,
    bankAccount: start + actualIncome - actualExpenses,
    projectedBankAccount: start + projectedIncome - projectedExpenses,
  };
}
