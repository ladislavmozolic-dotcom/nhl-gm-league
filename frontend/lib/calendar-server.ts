import { prisma } from "./prisma";
import { defaultLeagueDate, phaseFor, effectivePhase, frenzyDay, frenzyRound, isFrenzyOpen, addDays, PHASE_LABEL, type Phase } from "./calendar";
import type { Phase as StatsPhase } from "./phase";

/** The current league-clock date (defaults to July 1 if the league hasn't started). */
export async function getLeagueDate(): Promise<Date> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { leagueDate: true } });
  return cfg?.leagueDate ?? defaultLeagueDate();
}

export type LeagueClock = {
  date: Date; phase: Phase; phaseLabel: string;
  frenzyOpen: boolean; frenzyDay: number; frenzyRound: number; faForced: boolean;
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
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { leagueDate: true, faOpen: true, phaseOverride: true } });
  const date = cfg?.leagueDate ?? defaultLeagueDate();
  const phase = effectivePhase(date, cfg?.phaseOverride);
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
    const tomorrowPhase = effectivePhase(tomorrow, cfg?.phaseOverride);
    const tomorrowFrenzyOpen = faForced || isFrenzyOpen(tomorrow);
    const preview = faWindowFor(tomorrowPhase, tomorrowFrenzyOpen);
    if (preview.open) faWindow = { ...preview, previewOnly: true };
  }

  return {
    date, phase, phaseLabel: PHASE_LABEL[phase],
    frenzyOpen,
    frenzyDay: frenzyDay(date),
    frenzyRound: isFrenzyOpen(date) ? frenzyRound(date) : (faForced ? 1 : 0),
    faForced,
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
