// Real-clock automatic league-day advance. Only fires when the phase is following
// the calendar (LeagueConfig.phaseOverride === null, i.e. the admin has "Auto
// (calendar)" selected on /admin/season) — an admin who manually pins a phase is
// actively steering the league by hand, so the clock pauses too rather than
// second-guessing them.
//
// Two DELIBERATELY SEPARATE triggers share the calendar day, matching real
// hockey (the date changes at midnight; that night's games are played in the
// evening) — this used to be one combined step at 20:30, which meant the
// displayed "current day" silently sat on YESTERDAY's date for the ~20 hours
// between midnight and the evening sim:
//   1. `simulateDayIfDue` — the 20:30-20:40 window, unchanged — plays whatever
//      is scheduled for the CURRENT `leagueDate` and runs that day's
//      bookkeeping (Frenzy transitions, waivers, cap compliance, ...).
//   2. `rolloverLeagueDateIfDue` — checked on every tick, no time window —
//      once real Bratislava time has moved into the next calendar day AND
//      today's evening sim has already completed (`lastSimulatedDay` equals
//      `leagueDate`), bumps `leagueDate` forward by exactly one day so the
//      displayed date tracks real time immediately, without waiting for
//      tonight's game-sim window.
import { prisma } from "./prisma";
import { simulateLeagueDay } from "@/app/admin/season/actions";
import { addDays } from "./calendar";
import { sweepExpiredContractsToUfa } from "./free-agency-server";

const TZ = "Europe/Bratislava";
const TRIGGER_HOUR = 20;
const TRIGGER_MINUTE = 30;
// The server-side cron tick fires every 5 minutes (see DEPLOY.md) — a 10-minute
// window comfortably covers one tick even if it lands a few minutes late, without
// risking bleeding into the NEXT day's window.
const WINDOW_MINUTES = 10;

/** Europe/Bratislava wall-clock date + time for `d`, DST-proof via Intl (no reliance
 *  on the server OS's own timezone, which is plain UTC — see DEPLOY.md). */
function bratislavaParts(d: Date): { dateStr: string; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value])) as Record<string, string>;
  return { dateStr: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

/** `d` (always UTC-midnight-normalized, see lib/calendar.ts `utcDay`) formatted the
 *  same "YYYY-MM-DD" way as `bratislavaParts` so the two are directly comparable. */
const isoDateStr = (d: Date) => d.toISOString().slice(0, 10);

export type AutoAdvanceResult =
  | { ran: false; reason: string }
  | ({ ran: true } & Awaited<ReturnType<typeof simulateLeagueDay>>);

/** Called by /api/cron/advance-day roughly every 5 minutes. Plays out the CURRENT
 *  `leagueDate` (never batches multiple days, even after downtime — a missed
 *  20:30 window just gets caught up gradually, one real day at a time, so an admin
 *  is never surprised by a pile of games simulating at once), at most once per
 *  league day, only inside the 20:30-20:40 Europe/Bratislava window. Does NOT
 *  advance `leagueDate` itself — see `rolloverLeagueDateIfDue` below. */
export async function simulateDayIfDue(now: Date = new Date()): Promise<AutoAdvanceResult> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true, leagueDate: true, lastSimulatedDay: true } });
  if (cfg?.phaseOverride) return { ran: false, reason: `phase is manually pinned to "${cfg.phaseOverride}", not following the calendar` };
  if (!cfg?.leagueDate) return { ran: false, reason: "league clock hasn't started" };

  const { hour, minute } = bratislavaParts(now);
  if (!(hour === TRIGGER_HOUR && minute >= TRIGGER_MINUTE && minute < TRIGGER_MINUTE + WINDOW_MINUTES)) {
    return { ran: false, reason: `outside the ${TRIGGER_HOUR}:${TRIGGER_MINUTE} Europe/Bratislava window (now ${hour}:${String(minute).padStart(2, "0")})` };
  }

  if (cfg.lastSimulatedDay?.getTime() === cfg.leagueDate.getTime()) return { ran: false, reason: "today's league day is already simulated" };

  const result = await simulateLeagueDay(cfg.leagueDate);
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { lastSimulatedDay: cfg.leagueDate } });
  return { ran: true, ...result };
}

export type RolloverResult = { rolled: false; reason: string } | { rolled: true; to: Date };

/** Called by /api/cron/advance-day on every tick (no time window — the goal is to
 *  catch real midnight within one ~5-minute poll). Advances the DISPLAYED
 *  `leagueDate` by exactly one day once real Bratislava time has moved past it —
 *  but only once that day's evening sim has actually completed
 *  (`lastSimulatedDay` matches), so the calendar can never skip a day whose
 *  games haven't been played (e.g. after cron downtime, it just waits). */
export async function rolloverLeagueDateIfDue(now: Date = new Date()): Promise<RolloverResult> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true, leagueDate: true, lastSimulatedDay: true } });
  if (cfg?.phaseOverride) return { rolled: false, reason: `phase is manually pinned to "${cfg.phaseOverride}", not following the calendar` };
  if (!cfg?.leagueDate) return { rolled: false, reason: "league clock hasn't started" };
  if (cfg.lastSimulatedDay?.getTime() !== cfg.leagueDate.getTime()) return { rolled: false, reason: "today's league day hasn't been simulated yet" };

  const todayStr = bratislavaParts(now).dateStr;
  if (todayStr <= isoDateStr(cfg.leagueDate)) return { rolled: false, reason: "not yet a new Europe/Bratislava day" };

  const to = addDays(cfg.leagueDate, 1);
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { leagueDate: to } });
  return { rolled: true, to };
}

export type FrenzyAutoOpenResult = { opened: false; reason: string } | { opened: true; expiredToUfa: number };

/** Called by /api/cron/advance-day alongside the two triggers above, every ~5 minutes.
 *  One-shot trigger: as soon as real "now" reaches the admin-set
 *  LeagueConfig.frenzyAutoOpenAt, force the Free Agent Frenzy window open for
 *  every GM (faOpen=true) — no wall-clock window to land in like the 20:30
 *  game-sim trigger, it fires on the very next tick after the target moment.
 *  Clears frenzyAutoOpenAt once fired so it never re-fires, and so a later
 *  manual close of faOpen (an admin turning the market back off) sticks.
 *  Also runs the same expired-contract → UFA sweep the calendar-driven Frenzy
 *  opening gets in `simulateLeagueDay` — a forced-open market should make an
 *  unresigned expired player available too, not just one whose old contract
 *  happens to fall inside the real July window. */
export async function autoOpenFrenzyIfDue(now: Date = new Date()): Promise<FrenzyAutoOpenResult> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { frenzyAutoOpenAt: true, faOpen: true } });
  if (!cfg?.frenzyAutoOpenAt) return { opened: false, reason: "no auto-open time set" };
  if (cfg.faOpen) { await prisma.leagueConfig.update({ where: { id: 1 }, data: { frenzyAutoOpenAt: null } }); return { opened: false, reason: "already open — cleared the stale trigger" }; }
  if (now.getTime() < cfg.frenzyAutoOpenAt.getTime()) return { opened: false, reason: `not due until ${cfg.frenzyAutoOpenAt.toISOString()}` };
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { faOpen: true, frenzyAutoOpenAt: null, frenzyRoundStartedAt: now } });
  const expiredToUfa = await sweepExpiredContractsToUfa();
  return { opened: true, expiredToUfa };
}
