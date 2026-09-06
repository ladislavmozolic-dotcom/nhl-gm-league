// Client-safe countdown math shared by the home page's "Next simulation" card
// and the Free Agent Frenzy round-close countdown — both tick toward the same
// daily 20:30:01 Europe/Bratislava trigger, just a different number of ticks out.

/** The next daily sim/day-advance trigger (20:30:01 Bratislava), as a UTC ms instant. */
export function nextSimUtcMs(now: Date): number {
  // wall-clock in Bratislava
  const brat = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Bratislava" }));
  const target = new Date(brat);
  target.setHours(20, 30, 1, 0);
  if (target.getTime() <= brat.getTime()) target.setDate(target.getDate() + 1);
  // difference is frame-independent
  return now.getTime() + (target.getTime() - brat.getTime());
}

/** A Frenzy round is 7 days. When the market is running off the real July
 *  calendar, the league clock advances one in-game day per daily trigger, so
 *  "round N closes" is the trigger `7*round - day` ticks from now (0 = the
 *  very next trigger closes it today). But a FORCE-opened market (faOpen, any
 *  time of year) has no calendar day to derive that from — `roundStartedAt`
 *  (real wall-clock ISO instant the round began, from LeagueConfig.
 *  frenzyRoundStartedAt) is the actual source of truth there: round closes
 *  exactly 7 real days after it started, independent of the daily tick. An
 *  admin can still close a round early via the manual button — this doesn't
 *  know about that until the page reloads, same caveat as the sim countdown
 *  not knowing about a manual re-sim. */
export function frenzyRoundCloseUtcMs(now: Date, frenzyRound: number, frenzyDay: number, roundStartedAt?: string | null): number {
  if (roundStartedAt) return new Date(roundStartedAt).getTime() + 7 * 86_400_000;
  const ticksLeft = Math.max(0, 7 * frenzyRound - frenzyDay);
  return nextSimUtcMs(now) + ticksLeft * 86_400_000;
}
