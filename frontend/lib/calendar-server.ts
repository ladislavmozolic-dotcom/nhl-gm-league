import { prisma } from "./prisma";
import {
  defaultLeagueDate, frenzyDay, frenzyRound, isFrenzyOpen, addDays, utcDay,
  seasonOpen, FRENZY_WINDOW_DAYS, SEASON_START_YEAR, PHASES, PHASE_LABEL, type Phase,
} from "./calendar";
import { PRE_SEASON, REGULAR_SEASON } from "./phase";
import type { Phase as StatsPhase } from "./phase";

/** The current league-clock date (defaults to July 1 if the league hasn't started). */
export async function getLeagueDate(): Promise<Date> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { leagueDate: true } });
  return cfg?.leagueDate ?? defaultLeagueDate();
}

/** Real-date thresholds the "preseason"/"regular"/"playoffs" phases begin at, resolved
 *  in priority order for each: (1) the admin-configured LeagueConfig field (Season
 *  Control), (2) derived from the actual generated schedule (its first — or for
 *  playoffs, the day after its last — game), (3) the old fixed calendar-year fallback,
 *  for a brand-new league with no schedule yet. Playoffs has no configurable field of
 *  its own — it always follows directly from when the regular season's games run out. */
export async function resolvePhaseThresholds(year = SEASON_START_YEAR): Promise<{ preseasonAt: Date; regularAt: Date; playoffsAt: Date }> {
  const [cfg, firstPre, firstReg, lastReg] = await Promise.all([
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { preseasonPhaseAt: true, regularPhaseAt: true } }),
    prisma.game.findFirst({ where: { season: PRE_SEASON }, orderBy: { gameDate: "asc" }, select: { gameDate: true } }),
    prisma.game.findFirst({ where: { season: REGULAR_SEASON, league: "NHL", seriesId: null }, orderBy: { gameDate: "asc" }, select: { gameDate: true } }),
    prisma.game.findFirst({ where: { season: REGULAR_SEASON, league: "NHL", seriesId: null }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
  ]);
  const preseasonAt = cfg?.preseasonPhaseAt ?? firstPre?.gameDate ?? new Date(Date.UTC(year, 8, 21)); // Sep 21 fallback
  const regularAt = cfg?.regularPhaseAt ?? firstReg?.gameDate ?? new Date(Date.UTC(year, 9, 1));       // Oct 1 fallback
  const playoffsAt = lastReg?.gameDate ? addDays(lastReg.gameDate, 1) : new Date(Date.UTC(year + 1, 3, 15)); // Apr 15 fallback
  return { preseasonAt, regularAt, playoffsAt };
}

/** DB-aware phase computation — the one to use for "what phase is it right now" /
 *  "what phase does day X fall in" anywhere live-clock logic needs it (the sim day
 *  loop, opening-day sweeps, the Frenzy round transition, commissioner tools). The
 *  plain `effectivePhase`/`phaseFor` in ./calendar stay as the pure, schedule-blind
 *  fallback (still fine for a one-off "what would date X be under the OLD fixed
 *  calendar" utility, but not for anything driving real season progression). */
export async function computePhase(date: Date, override?: string | null): Promise<Phase> {
  if (override && (PHASES as string[]).includes(override)) return override as Phase;
  const d = utcDay(date).getTime();
  const open = seasonOpen().getTime();
  const frenzyEnd = addDays(seasonOpen(), FRENZY_WINDOW_DAYS).getTime();
  const finals = new Date(Date.UTC(SEASON_START_YEAR + 1, 5, 20)).getTime(); // Jun 20 — unchanged, not asked to be configurable
  if (d >= open && d < frenzyEnd) return "frenzy";
  const { preseasonAt, regularAt, playoffsAt } = await resolvePhaseThresholds();
  const pre = utcDay(preseasonAt).getTime(), reg = utcDay(regularAt).getTime(), po = utcDay(playoffsAt).getTime();
  if (d >= frenzyEnd && d < pre) return "offseason";
  if (d >= pre && d < reg) return "preseason";
  if (d >= reg && d < po) return "regular";
  if (d >= po && d < finals) return "playoffs";
  return "offseason";
}

export type LeagueClock = {
  date: Date; phase: Phase; phaseLabel: string;
  frenzyOpen: boolean; frenzyDay: number; frenzyRound: number; faForced: boolean;
  // Real wall-clock moment the current round began — set only when the round's
  // start/advance isn't driven by the real July calendar (see the field's own
  // schema comment). Countdown UIs prefer this + 7 days over the day/round
  // index math above whenever it's present.
  frenzyRoundStartedAt: string | null;
  // Broader FA-signing window: the July Frenzy is offer-based; the regular season
  // signs UFAs immediately (own + market); playoffs allow immediate signings but
  // only of a club's OWN UFAs; off-season outside the Frenzy is closed.
  // `previewOnly` = this shape is actually TOMORROW's window — the market is still
  // closed to ordinary GMs today, but the commissioner's office may act on it a day
  // early (see faWindowFor below).
  faWindow: { open: boolean; immediate: boolean; ownOnly: boolean; previewOnly: boolean };
};

function faWindowFor(phase: Phase, frenzyOpen: boolean): { open: boolean; immediate: boolean; ownOnly: boolean } {
  return frenzyOpen
    ? { open: true, immediate: false, ownOnly: false }          // July Frenzy — offer-based
    : phase === "regular"
      ? { open: true, immediate: true, ownOnly: false }         // regular season — sign own + market UFAs now
      : phase === "playoffs"
        ? { open: true, immediate: true, ownOnly: true }        // playoffs — own UFAs only
        : { open: false, immediate: false, ownOnly: false };    // off-season outside the Frenzy — closed
}

/** Everything the UI needs about "what day is it in the league". */
export async function getLeagueClock(): Promise<LeagueClock> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { leagueDate: true, faOpen: true, phaseOverride: true, frenzyRoundStartedAt: true } });
  const date = cfg?.leagueDate ?? defaultLeagueDate();
  const phase = await computePhase(date, cfg?.phaseOverride);
  const faForced = !!cfg?.faOpen;
  const frenzyOpen = faForced || isFrenzyOpen(date);
  const today = faWindowFor(phase, frenzyOpen);

  // Comish/Co-Comish head start: whenever the market is closed to everyone today but
  // opens tomorrow (the Frenzy's July 1 open, or the regular-season opener), the
  // commissioner's office may already act on tomorrow's window — they already see the
  // whole field of competing offers, so a day's head start isn't hidden information.
  let faWindow: LeagueClock["faWindow"] = { ...today, previewOnly: false };
  if (!today.open) {
    const tomorrow = addDays(date, 1);
    const tomorrowPhase = await computePhase(tomorrow, cfg?.phaseOverride);
    const tomorrowFrenzyOpen = faForced || isFrenzyOpen(tomorrow);
    const preview = faWindowFor(tomorrowPhase, tomorrowFrenzyOpen);
    if (preview.open) faWindow = { ...preview, previewOnly: true };
  }

  return {
    date, phase, phaseLabel: PHASE_LABEL[phase],
    frenzyOpen,
    // faForced fallback matches frenzyRound below — a force-opened market
    // (frenzyAutoOpenAt, outside the real July window) has no real calendar day to
    // read, so it reads as day 1 rather than "closed" (0), same as frenzyRound does.
    frenzyDay: isFrenzyOpen(date) ? frenzyDay(date) : (faForced ? 1 : 0),
    frenzyRound: isFrenzyOpen(date) ? frenzyRound(date) : (faForced ? 1 : 0),
    faForced,
    frenzyRoundStartedAt: faForced ? (cfg?.frenzyRoundStartedAt?.toISOString() ?? null) : null,
    faWindow,
  };
}

/** Which stats-view phase ("pre" | "regular" | "playoffs") the site should default
 *  to right now, purely from the live league clock — pages that support an explicit
 *  ?phase= override still let a visitor look at either view regardless of this. */
export async function defaultStatsPhase(): Promise<StatsPhase> {
  const { phase } = await getLeagueClock();
  return phase === "preseason" ? "pre" : phase === "playoffs" ? "playoffs" : "regular";
}
