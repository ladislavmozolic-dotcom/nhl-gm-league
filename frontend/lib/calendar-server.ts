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
};

/** Everything the UI needs about "what day is it in the league". */
export async function getLeagueClock(): Promise<LeagueClock> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { leagueDate: true, faOpen: true, phaseOverride: true } });
  const date = cfg?.leagueDate ?? defaultLeagueDate();
  const phase = effectivePhase(date, cfg?.phaseOverride);
  const faForced = !!cfg?.faOpen;
  return {
    date, phase, phaseLabel: PHASE_LABEL[phase],
    frenzyOpen: faForced || isFrenzyOpen(date),
    frenzyDay: frenzyDay(date),
    frenzyRound: isFrenzyOpen(date) ? frenzyRound(date) : (faForced ? 1 : 0),
    faForced,
  };
}
