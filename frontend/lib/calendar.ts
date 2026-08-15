// League calendar — a 365-day clock. The league year runs from July 1 (the real
// free-agency open) through June 30, and advances one day at a time even when no
// games are played. All day math is done at UTC midnight to stay DST-proof.

export const SEASON_LABEL = "2026-27";
export const SEASON_START_YEAR = 2026; // the July in which the league year opens

const DAY = 86_400_000;
export const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const addDays = (d: Date, n: number) => new Date(utcDay(d).getTime() + n * DAY);
export const daysBetween = (a: Date, b: Date) => Math.round((utcDay(b).getTime() - utcDay(a).getTime()) / DAY);

/** July 1 — the moment Free Agent Frenzy opens (labelled 19:00 local). */
export const seasonOpen = (year = SEASON_START_YEAR) => new Date(Date.UTC(year, 6, 1));
/** Regular season faces off October 1 — the round=0 anchor the sim already uses. */
export const regularStart = (year = SEASON_START_YEAR) => new Date(Date.UTC(year, 9, 1));
/** The league year wraps the following June 30. */
export const seasonEnd = (year = SEASON_START_YEAR) => new Date(Date.UTC(year + 1, 5, 30));

/** Default clock position when the league has never been started. */
export const defaultLeagueDate = () => seasonOpen();

/** The scheduling round index for a calendar date (Oct 1 = round 0). Negative in
 *  the off-season / preseason (no games scheduled there). */
export const roundForDate = (date: Date, year = SEASON_START_YEAR) => daysBetween(regularStart(year), date);

export type Phase = "frenzy" | "offseason" | "preseason" | "regular" | "playoffs";

/** How long the Free Agent Frenzy stays open — three weekly negotiation rounds
 *  (July 1 → 21). Week 1 = round 1 (open high), week 3 = round 3 (final decision). */
export const FRENZY_WINDOW_DAYS = 21;
export const FRENZY_ROUNDS = 3;

export function phaseFor(date: Date, year = SEASON_START_YEAR): Phase {
  const d = utcDay(date).getTime();
  const open = seasonOpen(year).getTime();
  const frenzyEnd = addDays(seasonOpen(year), FRENZY_WINDOW_DAYS).getTime(); // Jul 8
  const preseason = new Date(Date.UTC(year, 8, 21)).getTime(); // Sep 21
  const reg = regularStart(year).getTime();                    // Oct 1
  const playoffs = new Date(Date.UTC(year + 1, 3, 15)).getTime(); // Apr 15
  const finals = new Date(Date.UTC(year + 1, 5, 20)).getTime();   // Jun 20
  if (d >= open && d < frenzyEnd) return "frenzy";
  if (d >= frenzyEnd && d < preseason) return "offseason";
  if (d >= preseason && d < reg) return "preseason";
  if (d >= reg && d < playoffs) return "regular";
  if (d >= playoffs && d < finals) return "playoffs";
  return "offseason";
}

export const PHASES: Phase[] = ["offseason", "preseason", "regular", "playoffs", "frenzy"];

/** The effective phase. An admin can pin it manually (`override`) — leagues don't all
 *  run on the real calendar — otherwise it follows the date-driven `phaseFor`. */
export function effectivePhase(date: Date, override?: string | null): Phase {
  if (override && (PHASES as string[]).includes(override)) return override as Phase;
  return phaseFor(date);
}

export const PHASE_LABEL: Record<Phase, string> = {
  frenzy: "Free Agent Frenzy",
  offseason: "Off-season",
  preseason: "Preseason",
  regular: "Regular season",
  playoffs: "Playoffs",
};

/** Is the free-agent market open on this date? (the 7-day July window). */
export const isFrenzyOpen = (date: Date, year = SEASON_START_YEAR) => phaseFor(date, year) === "frenzy";

/** Day number within the frenzy window (1..21), or 0 if the window is closed. */
export function frenzyDay(date: Date, year = SEASON_START_YEAR): number {
  if (!isFrenzyOpen(date, year)) return 0;
  return daysBetween(seasonOpen(year), date) + 1;
}

/** Which weekly negotiation round the frenzy is in (1..3), or 0 if closed. */
export function frenzyRound(date: Date, year = SEASON_START_YEAR): number {
  const d = frenzyDay(date, year);
  if (d === 0) return 0;
  return Math.min(FRENZY_ROUNDS, Math.ceil(d / 7));
}

/** Fraction of the regular season elapsed (0..1) — drives the 1/3 & 2/3 promise checks. */
export function seasonFraction(date: Date, year = SEASON_START_YEAR): number {
  const total = daysBetween(regularStart(year), new Date(Date.UTC(year + 1, 3, 15)));
  const done = roundForDate(date, year);
  return Math.max(0, Math.min(1, done / total));
}

/** Days until the next Free Agent Frenzy opens (0 while it is open). */
export function daysUntilFrenzy(date: Date, year = SEASON_START_YEAR): number {
  if (isFrenzyOpen(date, year)) return 0;
  const d = utcDay(date).getTime();
  const target = d <= seasonOpen(year).getTime() ? seasonOpen(year) : seasonOpen(year + 1);
  return daysBetween(date, target);
}

export const fmtLeagueDate = (d: Date) =>
  utcDay(d).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
