// Automatic daily simulation. A scheduler (instrumentation.ts) calls
// runAutoSimIfDue() periodically; at the configured Bratislava time it plays
// the next unplayed day of games, once per calendar day.

import { prisma } from "../prisma";
import { playScheduledGames } from "./season";
import { processFinances } from "../finance-server";

const SEASON = "2026-27";

/** Current wall-clock in Europe/Bratislava as { date: "YYYY-MM-DD", hour, minute }. */
export function bratislavaNow(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}

export async function getAutoSim() {
  return (await prisma.autoSim.findUnique({ where: { id: 1 } })) ?? (await prisma.autoSim.create({ data: { id: 1 } }));
}

/** Play the next unplayed round (day) of games — NHL + AHL — then run finances. */
export async function playNextSimDay() {
  const next = await prisma.game.findFirst({ where: { season: SEASON, status: "SCHEDULED", round: { not: null } }, orderBy: [{ round: "asc" }], select: { round: true } });
  if (!next || next.round == null) return { played: 0, round: null as number | null };
  const r = await playScheduledGames({ season: SEASON, round: next.round });
  await processFinances(SEASON, "NHL");
  return { played: r.played, round: next.round };
}

// Once-a-day (per server process) check for the upcoming draft class. NHL Central
// Scouting publishes the next year's rankings DURING the season (midterm ~Jan,
// final ~Apr); this imports/refreshes them automatically as soon as they appear.
let lastDraftImport = "";
export async function runDraftImportIfDue() {
  const { date } = bratislavaNow();
  if (lastDraftImport === date) return { ran: false as const };
  lastDraftImport = date;
  try {
    const { autoImportUpcomingClass } = await import("../draft-class-import");
    const r = await autoImportUpcomingClass();
    if (r.imported) console.log(`[auto-draft] ${date}: imported ${r.imported} prospects for the ${r.year} draft class`);
    return { ran: true as const, ...r };
  } catch (e) { console.error("[auto-draft] error", e); return { ran: false as const }; }
}

/** Run the automatic sim if the configured time has passed and it hasn't run today. */
export async function runAutoSimIfDue() {
  const cfg = await getAutoSim();
  if (!cfg.enabled) return { ran: false, reason: "disabled" as const };
  const { date, hour, minute } = bratislavaNow();
  const due = hour > cfg.hour || (hour === cfg.hour && minute >= cfg.minute);
  if (!due) return { ran: false, reason: "not-due" as const };
  if (cfg.lastRunDate === date) return { ran: false, reason: "already-ran" as const };

  const res = await playNextSimDay();
  await prisma.autoSim.update({ where: { id: 1 }, data: { lastRunDate: date } });
  if (res.played) console.log(`[auto-sim] ${date}: played round ${res.round} (${res.played} games)`);
  return { ran: true, ...res };
}
