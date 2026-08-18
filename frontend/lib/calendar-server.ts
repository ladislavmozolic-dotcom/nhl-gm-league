import { prisma } from "./prisma";
import { defaultLeagueDate, phaseFor, effectivePhase, frenzyDay, frenzyRound, isFrenzyOpen, PHASE_LABEL, type Phase } from "./calendar";

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
  faWindow: { open: boolean; immediate: boolean; ownOnly: boolean };
};

/** Everything the UI needs about "what day is it in the league". */
export async function getLeagueClock(): Promise<LeagueClock> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { leagueDate: true, faOpen: true, phaseOverride: true } });
  const date = cfg?.leagueDate ?? defaultLeagueDate();
  const phase = effectivePhase(date, cfg?.phaseOverride);
  const faForced = !!cfg?.faOpen;
  const frenzyOpen = faForced || isFrenzyOpen(date);
  const faWindow = frenzyOpen
    ? { open: true, immediate: false, ownOnly: false }          // July Frenzy — offer-based
    : phase === "regular"
      ? { open: true, immediate: true, ownOnly: false }         // regular season — sign own + market UFAs now
      : phase === "playoffs"
        ? { open: true, immediate: true, ownOnly: true }        // playoffs — own UFAs only
        : { open: false, immediate: false, ownOnly: false };    // off-season outside the Frenzy — closed
  return {
    date, phase, phaseLabel: PHASE_LABEL[phase],
    frenzyOpen,
    frenzyDay: frenzyDay(date),
    frenzyRound: isFrenzyOpen(date) ? frenzyRound(date) : (faForced ? 1 : 0),
    faForced,
    faWindow,
  };
}
