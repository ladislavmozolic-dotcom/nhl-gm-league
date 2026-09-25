import "server-only";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { playScheduledGames, updateInjuryCon } from "@/lib/sim/season";
import { advancePlayoffDay } from "@/lib/sim/playoffs";
import { processFinances } from "@/lib/finance-server";
import { commissionerName } from "@/lib/audit-server";
import { loadSettings } from "@/lib/sim/settings";
import { autoFillRosters, fillAhlFromScratched } from "@/lib/roster-fill";
import { aiGmDaily } from "@/lib/ai-gm";
import { getLeagueDate, computePhase } from "@/lib/calendar-server";
import { addDays, utcDay, frenzyRound, roundForDate } from "@/lib/calendar";
import { processWaivers } from "@/lib/waivers-server";
import { playPreseasonDay, recoverPreseasonIdleTeams, PRE_SEASON } from "@/lib/preseason";
import { postWeeklyIfDue } from "@/lib/weekly-digest";
import { resolveFrenzy, processRoundEnd, resolveInSeasonWindows } from "@/app/free-agents/actions";
import { sweepExpiredContractsToUfa, sweepUnsignedRfasToNonRoster } from "@/lib/free-agency-server";
import { checkPromises } from "@/lib/promises";
import { checkIceTimeMorale } from "@/lib/player-morale";
import { leagueCapCompliance } from "@/lib/cap";
import { money } from "@/lib/finance";
import { runLiveCalculatorRecompute } from "@/lib/live-calculator-engine";

const SEASON = "2026-27";

/** Recover conditioning + heal injuries by one day (a day off, no games).
 *  Healthy skaters regain fatigue-CON; injured skaters' CON is driven by their
 *  remaining injury days instead (see updateInjuryCon). */
async function recoverOneDay() {
  const settings = await loadSettings();
  const skRec = Math.max(1, Math.round(settings.skaterConRecovery));
  const where = { team: { league: { in: ["NHL", "AHL"] } } };
  await prisma.player.updateMany({ where: { ...where, isGoalie: false, injuryDaysLeft: { lte: 0 } }, data: { condition: { increment: skRec } } });
  await prisma.player.updateMany({ where: { ...where, isGoalie: true }, data: { condition: { increment: 2 } } });
  await prisma.player.updateMany({ where: { ...where, condition: { gt: 100 } }, data: { condition: 100 } });
  await prisma.player.updateMany({ where: { injuryDaysLeft: { gt: 0 } }, data: { injuryDaysLeft: { decrement: 1 } } });
  await prisma.player.updateMany({ where: { injuryDaysLeft: { lt: 0 } }, data: { injuryDaysLeft: 0 } });
  await updateInjuryCon();
}

/** Plays out league day `day` — the games/CON-recovery/Frenzy-transition/waiver/
 *  cap-compliance bookkeeping for that ONE calendar day — WITHOUT touching
 *  `LeagueConfig.leagueDate` itself. Shared by the admin "Advance Day" button
 *  (`advanceLeagueDayCore`, which bumps the pointer first, then calls this) and
 *  the automatic 20:30 Europe/Bratislava cron trigger (`lib/season-cron.ts`),
 *  which only calls this once `leagueDate` already equals `day` — separately
 *  advanced at real midnight by that same file's day-rollover check, so the
 *  displayed calendar date tracks real time even though games only get
 *  simulated in the evening. If games are scheduled that date, they are
 *  played; a regular-season off-day recovers CON; the off-season simply lets
 *  the date move (Frenzy lives here). */
export async function simulateLeagueDay(day: Date) {
  const yesterday = addDays(day, -1);
  const cfg0 = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true } });
  // computed once, up front — every phYesterday/phToday reference below reuses these
  // (DB-aware: honors the manual pin, else the configured/schedule-derived thresholds)
  const phYesterday = await computePhase(yesterday, cfg0?.phaseOverride);
  const phToday = await computePhase(day, cfg0?.phaseOverride);
  const start = utcDay(day), end = addDays(day, 1);
  const dayGames = await prisma.game.findMany({
    where: { season: SEASON, status: "SCHEDULED", seriesId: null, gameDate: { gte: start, lt: end } },
    select: { round: true }, orderBy: { round: "asc" },
  });
  const preDue = await prisma.game.count({ where: { season: PRE_SEASON, status: "SCHEDULED", gameDate: { gte: start, lt: end } } });
  let played = 0;
  // AI GM runs EVERY day — tactics, cap compliance, and Advanced-AI trade negotiation
  // (accept/decline/counter/offer) — regardless of whether games are scheduled, so a
  // human's proposal to an AI club gets answered even in the off-season or schedule gaps.
  await aiGmDaily();
  if (dayGames.length && dayGames[0].round != null) {
    await autoFillRosters("NHL");
    await fillAhlFromScratched();
    const r = await playScheduledGames({ season: SEASON, round: dayGames[0].round, actor: await commissionerName() });
    played = r.played;
    await processFinances(SEASON, "NHL");
  } else if (phToday === "regular" || phToday === "playoffs" || (phToday === "preseason" && preDue === 0)) {
    await recoverOneDay();
  }
  // Pre-season games scheduled for this day play out too (exhibition; own season
  // string, so they never touch standings/stats/careers). Lets the calendar roll the
  // whole pre-season out day-by-day before the regular season begins.
  if (preDue > 0) {
    await recoverPreseasonIdleTeams(start, end);
    await autoFillRosters("NHL").catch(() => {});
    await autoFillRosters("AHL").catch(() => {});
    const pr = await playPreseasonDay(start, end, await commissionerName());
    played += pr.played;
  }
  // Playoff games scheduled for today play out (day-by-day, no back-to-backs). When a
  // round finishes, the next round is seeded & scheduled automatically.
  const poDue = await prisma.game.count({ where: { season: SEASON, seriesId: { not: null }, status: "SCHEDULED", gameDate: { gte: start, lt: end } } });
  if (poDue > 0) {
    await autoFillRosters("NHL").catch(() => {});
    for (const lg of ["NHL", "AHL"] as const) {
      const po = await advancePlayoffDay(SEASON, lg, start, end);
      played += po.played;
    }
    // Playoff gates, merchandise uplift and earned sponsor bonuses are real cash,
    // so refresh the same Detailed Finance ledger after every playoff day too.
    await processFinances(SEASON, "NHL");
  }
  // weekly newsletter — auto-posts once when a 7-round week completes (self-dedupes)
  await postWeeklyIfDue(roundForDate(day)).catch(() => {});
  // ice-time promise check (self-gates to the regular season past 1/3)
  const promises = await checkPromises();
  // ice-time morale for everyone else: warn → trade request → unwinds when fixed
  await checkIceTimeMorale().catch((e) => console.error("[ice-morale]", e));
  // waivers: resolve any whose one-day window closed (claimed by priority, else clear to AHL)
  const waivers = await processWaivers(roundForDate(day), phToday);
  // Free Agent Frenzy round transitions (3 weekly rounds). Crossing a week
  // boundary inside the window runs counters / shortlisting; leaving the window
  // (end of round 3) signs everyone's best offer.
  let signed = 0;
  let expiredToUfa = 0;
  if (phYesterday === "frenzy" && phToday !== "frenzy") {
    const r = await resolveFrenzy();
    signed = r.signed;
  } else if (phYesterday === "frenzy" && phToday === "frenzy" && frenzyRound(yesterday) !== frenzyRound(day)) {
    await processRoundEnd(frenzyRound(yesterday));
  }
  // Frenzy opening (calendar-driven, e.g. the real July 1 window) — anyone whose
  // contract already ran out and nobody re-signed becomes available the moment the
  // market opens, same as the regular-season opening-day sweep below (the admin-
  // forced open via frenzyAutoOpenAt gets the same treatment separately, right when
  // it fires — see lib/season-cron.ts).
  if (phYesterday !== "frenzy" && phToday === "frenzy") {
    expiredToUfa += await sweepExpiredContractsToUfa();
  }
  // in-season UFA market: resolve any player whose 7-day deliberation (or 3-day match)
  // window has closed — sign the best offer, or counter the bidders for a few more days.
  const inSeasonFa = await resolveInSeasonWindows(day);
  signed += inSeasonFa.signed;
  // opening-day cap compliance: the +10% summer cushion expires — every club must
  // now sit under the strict ceiling. Non-compliant clubs get a public warning.
  let capOffenders = 0;
  // opening-day free agency: anyone whose contract already expired (0 years left)
  // and who nobody re-signed during the off-season/Frenzy window hits the open
  // market the moment regular season starts too (on top of the Frenzy-opening sweep
  // above — idempotent, so re-running it here just catches anyone who expired since).
  if (phYesterday !== "regular" && phToday === "regular") {
    const offenders = await leagueCapCompliance("regular");
    capOffenders = offenders.filter((o) => o.over > 0).length;
    for (const o of offenders) {
      if (o.over > 0) await prisma.transaction.create({ data: { type: "CAP_WARNING", message: `${o.code} is over the salary cap by ${money(o.over)} on opening day — must shed salary to be compliant.` } });
    }
    expiredToUfa += await sweepExpiredContractsToUfa();
    // RFA-age players never re-signed by their own club through the whole off-season
    // get benched (Non-roster), not dumped into the open UFA pool — see
    // sweepUnsignedRfasToNonRoster's own doc comment for why.
    await sweepUnsignedRfasToNonRoster();
  }
  if (played > 0) {
    runLiveCalculatorRecompute().catch((err) =>
      console.error("[LiveCalculator] Auto recompute error:", err)
    );
  }
  for (const p of ["/calendar", "/schedule", "/standings", "/scores", "/admin/season", "/finance", "/free-agents", "/signings", "/waivers", "/tools/player-calculator", "/"]) revalidatePath(p);
  return { date: day, phase: phToday, played, signed, warned: promises.warned, requested: promises.requested, capOffenders, expiredToUfa, waiverClaims: waivers.claimed, waiverClears: waivers.cleared };
}

/** Admin "Advance Day": bumps the league clock to tomorrow, then plays that day
 *  out immediately — one atomic, deliberate step (unlike the automatic cron,
 *  which lets the calendar flip at real midnight and only simulates in the
 *  20:30 window; see `lib/season-cron.ts`). */
export async function advanceLeagueDayCore() {
  const next = addDays(await getLeagueDate(), 1);
  await prisma.leagueConfig.upsert({ where: { id: 1 }, update: { leagueDate: next }, create: { id: 1, leagueDate: next } });
  return simulateLeagueDay(next);
}
