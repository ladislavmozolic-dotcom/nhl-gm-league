// Real-clock automatic league-day advance. Only fires when the phase is following
// the calendar (LeagueConfig.phaseOverride === null, i.e. the admin has "Auto
// (calendar)" selected on /admin/season) — an admin who manually pins a phase is
// actively steering the league by hand, so the clock pauses too rather than
// second-guessing them.
import { prisma } from "./prisma";
import { advanceLeagueDayCore } from "@/app/admin/season/actions";

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

export type AutoAdvanceResult =
  | { ran: false; reason: string }
  | ({ ran: true } & Awaited<ReturnType<typeof advanceLeagueDayCore>>);

/** Called by /api/cron/advance-day roughly every 5 minutes. Advances the league day
 *  by exactly one (never batches multiple days, even after downtime — a missed
 *  20:30 window just gets caught up gradually, one real day at a time, so an admin
 *  is never surprised by a pile of games simulating at once), at most once per real
 *  calendar day, only inside the 20:30-20:40 Europe/Bratislava window. */
export async function autoAdvanceIfDue(now: Date = new Date()): Promise<AutoAdvanceResult> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true, lastAutoAdvance: true } });
  if (cfg?.phaseOverride) return { ran: false, reason: `phase is manually pinned to "${cfg.phaseOverride}", not following the calendar` };

  const { dateStr, hour, minute } = bratislavaParts(now);
  if (!(hour === TRIGGER_HOUR && minute >= TRIGGER_MINUTE && minute < TRIGGER_MINUTE + WINDOW_MINUTES)) {
    return { ran: false, reason: `outside the ${TRIGGER_HOUR}:${TRIGGER_MINUTE} Europe/Bratislava window (now ${hour}:${String(minute).padStart(2, "0")})` };
  }

  const lastDateStr = cfg?.lastAutoAdvance ? bratislavaParts(cfg.lastAutoAdvance).dateStr : null;
  if (lastDateStr === dateStr) return { ran: false, reason: "already advanced today" };

  const result = await advanceLeagueDayCore();
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { lastAutoAdvance: now } });
  return { ran: true, ...result };
}

export type FrenzyAutoOpenResult = { opened: false; reason: string } | { opened: true };

/** Called by /api/cron/advance-day alongside autoAdvanceIfDue, every ~5 minutes.
 *  One-shot trigger: as soon as real "now" reaches the admin-set
 *  LeagueConfig.frenzyAutoOpenAt, force the Free Agent Frenzy window open for
 *  every GM (faOpen=true) — no wall-clock window to land in like the 20:30
 *  game-sim trigger, it fires on the very next tick after the target moment.
 *  Clears frenzyAutoOpenAt once fired so it never re-fires, and so a later
 *  manual close of faOpen (an admin turning the market back off) sticks. */
export async function autoOpenFrenzyIfDue(now: Date = new Date()): Promise<FrenzyAutoOpenResult> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { frenzyAutoOpenAt: true, faOpen: true } });
  if (!cfg?.frenzyAutoOpenAt) return { opened: false, reason: "no auto-open time set" };
  if (cfg.faOpen) { await prisma.leagueConfig.update({ where: { id: 1 }, data: { frenzyAutoOpenAt: null } }); return { opened: false, reason: "already open — cleared the stale trigger" }; }
  if (now.getTime() < cfg.frenzyAutoOpenAt.getTime()) return { opened: false, reason: `not due until ${cfg.frenzyAutoOpenAt.toISOString()}` };
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { faOpen: true, frenzyAutoOpenAt: null } });
  return { opened: true };
}
