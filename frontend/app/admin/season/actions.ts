"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateSchedule } from "@/lib/sim/schedule";
import { playScheduledGames, resetConditions, updateInjuryCon } from "@/lib/sim/season";
import { runPlayoffs, startPlayoffs, advancePlayoffDay } from "@/lib/sim/playoffs";
import { importCsvSchedule, importFromNhlApi } from "@/lib/sim/csv-schedule";
import { processFinances } from "@/lib/finance-server";
import { archiveSeason } from "@/lib/awards";
import { isAdmin } from "@/lib/auth";
import { commissionerName } from "@/lib/audit-server";
import { loadSettings } from "@/lib/sim/settings";
import { autoFillRosters, fillAhlFromScratched } from "@/lib/roster-fill";
import { aiGmDaily } from "@/lib/ai-gm";
import { getLeagueDate, computePhase } from "@/lib/calendar-server";
import { addDays, utcDay, PHASES, seasonOpen, defaultLeagueDate, frenzyRound, roundForDate } from "@/lib/calendar";
import { processWaivers } from "@/lib/waivers-server";
import { generatePreseason, playPreseason, playPreseasonDay, computeAutoPreseasonStart, PRE_SEASON } from "@/lib/preseason";
import { postWeeklyIfDue } from "@/lib/weekly-digest";
import { resolveFrenzy, processRoundEnd, resolveInSeasonWindows } from "@/app/free-agents/actions";
import { sweepExpiredContractsToUfa } from "@/lib/free-agency-server";
import { checkPromises } from "@/lib/promises";
import { autoImportUpcomingClass } from "@/lib/draft-class-import";
import { leagueCapCompliance } from "@/lib/cap";
import { money } from "@/lib/finance";

const SEASON = "2026-27";

/** Recover conditioning + heal injuries by one day (a day off, no games).
 *  Healthy skaters regain fatigue-CON; injured skaters' CON is driven by their
 *  remaining injury days instead (see updateInjuryCon). */
async function recoverOneDay() {
  const settings = await loadSettings();
  const skRec = Math.max(1, Math.round(settings.skaterConRecovery));
  const where = { team: { league: "NHL" as const } };
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
  } else if (phToday === "regular" || phToday === "playoffs") {
    await recoverOneDay();
  }
  // Pre-season games scheduled for this day play out too (exhibition; own season
  // string, so they never touch standings/stats/careers). Lets the calendar roll the
  // whole pre-season out day-by-day before the regular season begins.
  const preDue = await prisma.game.count({ where: { season: PRE_SEASON, status: "SCHEDULED", gameDate: { gte: start, lt: end } } });
  if (preDue > 0) {
    await autoFillRosters("NHL").catch(() => {});
    const pr = await playPreseasonDay(start, end);
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
  }
  // weekly newsletter — auto-posts once when a 7-round week completes (self-dedupes)
  await postWeeklyIfDue(roundForDate(day)).catch(() => {});
  // ice-time promise check (self-gates to the regular season past 1/3)
  const promises = await checkPromises();
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
  }
  for (const p of ["/calendar", "/schedule", "/standings", "/scores", "/admin/season", "/finance", "/free-agents", "/signings", "/waivers", "/"]) revalidatePath(p);
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

/** Admin: advance the league clock by one calendar day (manual button). */
export async function advanceLeagueDayAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can advance the league day.");
  return advanceLeagueDayCore();
}

/** Admin: jump the league clock to an explicit date (YYYY-MM-DD). */
export async function setLeagueDateAction(iso: string) {
  if (!(await isAdmin())) throw new Error("Only a league admin can set the league date.");
  const d = iso ? new Date(iso + "T00:00:00Z") : defaultLeagueDate();
  if (isNaN(d.getTime())) return { ok: false, error: "Invalid date." };
  await prisma.leagueConfig.upsert({
    where: { id: 1 }, update: { leagueDate: utcDay(d) }, create: { id: 1, leagueDate: utcDay(d) },
  });
  for (const p of ["/calendar", "/schedule", "/admin/season", "/free-agents"]) revalidatePath(p);
  const cfgP = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true } });
  return { ok: true, date: utcDay(d), phase: await computePhase(d, cfgP?.phaseOverride) };
}

/** Admin: (re)start the league clock at July 1 — the Free Agent Frenzy open. */
export async function startLeagueClockAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can start the league clock.");
  const d = seasonOpen();
  await prisma.leagueConfig.upsert({
    where: { id: 1 }, update: { leagueDate: d }, create: { id: 1, leagueDate: d },
  });
  for (const p of ["/calendar", "/schedule", "/admin/season", "/free-agents"]) revalidatePath(p);
  const cfgS = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true } });
  return { date: d, phase: await computePhase(d, cfgS?.phaseOverride) };
}

/** Admin: durably promote farm players onto any NHL club short of 12F/6D/2G, so
 *  they count against the cap and stay until the GM sends them down. */
export async function autoFillRostersAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can auto-fill rosters.");
  const filled = await autoFillRosters("NHL");
  for (const p of ["/teams", "/finance", "/admin/season"]) revalidatePath(p);
  return { teams: filled.length, promoted: filled.reduce((t, x) => t + x.f + x.d + x.g, 0), detail: filled };
}

/** Admin: run the AI GM now for every club with no registered GM — sets a roster-fit
 *  tactical system, keeps rosters legal, and sheds movable salary to get cap-compliant.
 *  Never trades or signs. (Also runs automatically before each simulated day.) */
export async function runAiGmAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can run the AI GM.");
  const { runAiGm } = await import("@/lib/ai-gm");
  const res = await runAiGm();
  for (const p of ["/teams", "/league", "/finance", "/admin/season"]) revalidatePath(p);
  return res;
}

/** Admin: run offseason retirements — aging players retire, and any newly-retired
 *  player with a Hall-of-Fame résumé is inducted. Part of season rollover. */
export async function runRetirementsAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can run retirements.");
  const { runRetirements } = await import("@/lib/hof-server");
  const res = await runRetirements("2026-27");
  for (const p of ["/hall-of-fame", "/retired", "/teams", "/players/all", "/admin/season"]) revalidatePath(p);
  return res;
}

/** Admin: create linked PROSPECT players for any draft picks that don't have one
 *  yet (one-time / after a draft), then develop all prospects one step. */
export async function developProspectsAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can develop prospects.");
  const { developProspects } = await import("@/lib/prospect-dev-server");
  const dev = await developProspects();
  for (const p of ["/teams", "/admin/season", "/admin/dashboard"]) revalidatePath(p);
  return { created: 0, ...dev };
}

/** Admin: simulate the NEXT scheduled day (one round) — a manual fallback if the
 *  nightly auto-sim fails, or for running practice sims day by day. */
export async function simNextDayAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can run the simulation.");
  const next = await prisma.game.findFirst({
    where: { season: SEASON, status: "SCHEDULED", seriesId: null },
    orderBy: [{ round: "asc" }, { gameDate: "asc" }, { id: "asc" }],
    select: { round: true, gameDate: true },
  });
  if (next?.round == null) return { played: 0, round: null as number | null, date: null as Date | null, done: true };
  await aiGmDaily();            // AI GM sets tactics + cap-compliance for GM-less clubs
  await autoFillRosters("NHL"); // ensure every club owns a legal roster (durable, counts to cap)
  await fillAhlFromScratched(); // farms activate healthy scratches so their games sim
  const r = await playScheduledGames({ season: SEASON, round: next.round, actor: await commissionerName() });
  await processFinances(SEASON, "NHL");
  // resolve any in-season UFA deliberation window that's come due — so signings progress
  // even when the season is moved via game-sim (not just the calendar's Advance Day).
  const inSeasonFa = await resolveInSeasonWindows(await getLeagueDate());
  for (const p of ["/schedule", "/standings", "/scores", "/stats/players", "/admin/season", "/finance", "/free-agents", "/signings"]) revalidatePath(p);
  return { played: r.played, round: next.round, date: next.gameDate, done: false, signed: inSeasonFa.signed };
}

const DRAFT_ROUNDS = [1, 2, 3, 4, 5, 6, 7];

/** Admin: give every club its OWN draft picks (all 7 rounds) for the next
 *  `years` drafts — no real-NHL trades. Replaces the real-source pick set. */
export async function resetOwnDraftPicksAction(years = 5) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, profinhlLogoId: true } });
  const agg = await prisma.draftPick.aggregate({ where: { source: "real" }, _min: { year: true } });
  const base = agg._min.year ?? 2026;
  const yearList = Array.from({ length: years }, (_, i) => base + i);
  await prisma.draftPick.deleteMany({ where: { source: "real" } });
  const data = teams.flatMap((t) => yearList.flatMap((y) => DRAFT_ROUNDS.map((r) => ({ teamId: t.id, year: y, round: r, ownerLogoId: t.profinhlLogoId ?? 0, source: "real" }))));
  await prisma.draftPick.createMany({ data });
  for (const p of ["/tools/all-rosters", "/teams", "/draft"]) revalidatePath(p);
  return { ok: true as const, years: yearList, created: data.length };
}

/** Admin: roll the draft-pick window forward one season — drop the earliest
 *  (just-drafted) year and add a fresh year of own picks for every club, so the
 *  league always sits on a rolling 5-year horizon. */
export async function rollDraftYearForwardAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const agg = await prisma.draftPick.aggregate({ where: { source: "real" }, _min: { year: true }, _max: { year: true } });
  if (agg._min.year == null || agg._max.year == null) return { ok: false as const, error: "No draft picks to roll — reset them first." };
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, profinhlLogoId: true } });
  const dropped = agg._min.year, added = agg._max.year + 1;
  await prisma.draftPick.deleteMany({ where: { source: "real", year: dropped } });
  await prisma.draftPick.createMany({ data: teams.flatMap((t) => DRAFT_ROUNDS.map((r) => ({ teamId: t.id, year: added, round: r, ownerLogoId: t.profinhlLogoId ?? 0, source: "real" }))) });
  for (const p of ["/tools/all-rosters", "/teams", "/draft"]) revalidatePath(p);
  return { ok: true as const, dropped, added };
}

/** Admin: simulate several scheduled days in one go (a longer testing block).
 *  Loops simNextDayAction, stopping early when the season runs out of games. */
export async function simNextDaysAction(days: number) {
  if (!(await isAdmin())) throw new Error("Only a league admin can run the simulation.");
  const n = Math.max(1, Math.min(30, Math.round(days || 1)));
  let played = 0, daysRun = 0, lastRound: number | null = null, lastDate: Date | null = null;
  for (let i = 0; i < n; i++) {
    const r = await simNextDayAction();
    if (r.done) return { played, days: daysRun, round: lastRound, date: lastDate, done: true };
    played += r.played; daysRun++; lastRound = r.round; lastDate = r.date;
  }
  return { played, days: daysRun, round: lastRound, date: lastDate, done: false };
}

/** Admin: a day off — recover conditioning (CON) and heal injuries by one day,
 *  without playing any games. Pair with Sim Day to pace CON like a real schedule. */
export async function restDayAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can run the simulation.");
  const settings = await loadSettings();
  const skRec = Math.max(1, Math.round(settings.skaterConRecovery));
  const where = { team: { league: "NHL" as const } };
  await prisma.player.updateMany({ where: { ...where, isGoalie: false, injuryDaysLeft: { lte: 0 } }, data: { condition: { increment: skRec } } });
  await prisma.player.updateMany({ where: { ...where, isGoalie: true }, data: { condition: { increment: 2 } } });
  await prisma.player.updateMany({ where: { ...where, condition: { gt: 100 } }, data: { condition: 100 } });
  await prisma.player.updateMany({ where: { injuryDaysLeft: { gt: 0 } }, data: { injuryDaysLeft: { decrement: 1 } } });
  await prisma.player.updateMany({ where: { injuryDaysLeft: { lt: 0 } }, data: { injuryDaysLeft: 0 } });
  await updateInjuryCon();
  for (const p of ["/schedule", "/players", "/admin/season"]) revalidatePath(p);
  return { ok: true, skRec };
}

// Used as a <form action>, so it must return void (Next validates this at build time).
export async function archiveSeasonAction() {
  await archiveSeason(SEASON, "NHL");
  await archiveSeason(SEASON, "AHL");
  await autoRenewFarmDeals();
  revalidatePath("/admin/season");
  revalidatePath("/history");
}

/** Off-season: minor-league ($100k) farm deals renew automatically — they're
 *  placeholder contracts, not real re-sign candidates (a farm body who cracks the
 *  NHL just signs an ELC). Re-stamp any that are down to their last year back to an
 *  8-year term so they never expire onto the free-agent market or clutter re-sign lists.
 *  Real two-way deals below the NHL minimum (e.g. $600k-774k) are NOT farm deals — they
 *  re-sign normally like any other contract. */
export async function autoRenewFarmDeals() {
  const r = await prisma.player.updateMany({
    where: { capHit: 100_000, OR: [{ contractYears: null }, { contractYears: { lte: 1 } }] },
    data: { contractYears: 8 },
  });
  return { renewed: r.count };
}

/** Off-season step: import the upcoming draft class (NHL Central Scouting) so the next
 *  Draft Room has prospects. Tagged by roster mode. No-op until NHL publishes it.
 *  (The completed draft archives to Draft History on its own as the year rolls; the
 *  lottery is drawn from the Draft Lottery page.) */
export async function prepareNextDraftAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const r = await autoImportUpcomingClass();
  revalidatePath("/draft");
  revalidatePath("/draft/room");
  return { ok: true as const, year: r.year, imported: r.imported };
}

/** Admin: pin the league phase manually (Off-season / Pre-season / Regular / Playoffs),
 *  or pass null to follow the calendar again. Not every league runs on the real dates. */
export async function setPhaseOverrideAction(phase: string | null) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  if (phase !== null && !(PHASES as string[]).includes(phase)) return { ok: false as const, error: "Invalid phase." };
  await prisma.leagueConfig.upsert({ where: { id: 1 }, update: { phaseOverride: phase }, create: { id: 1, phaseOverride: phase } });
  // Pinning "Off-season" cascades: (re)build the exhibition schedule so its last
  // round lands exactly 3 days before the real regular-season opener — but only
  // when it's safe (no pre-season game has actually been played yet; a wipe+redo
  // would otherwise erase real results) and there's a regular-season schedule to
  // count back from at all. Stays admin-only visible (LeagueConfig.preseasonPublic)
  // until the admin explicitly makes it public — this cascade never flips that flag.
  let preseasonMsg: string | undefined;
  if (phase === "offseason") {
    const played = await prisma.game.count({ where: { season: PRE_SEASON, status: "FINAL" } });
    if (played > 0) {
      preseasonMsg = "Pre-season already has played games — left the existing schedule untouched.";
    } else {
      const start = await computeAutoPreseasonStart();
      if (!start) {
        preseasonMsg = "No regular-season schedule yet to count back from — pre-season not (re)generated.";
      } else {
        const r = await generatePreseason(start);
        preseasonMsg = `Pre-season (re)generated: ${r.games} games, ${r.firstDate.toDateString()} → ${r.lastDate.toDateString()} (admin-only until you make it public).`;
      }
    }
  }
  for (const p of ["/", "/admin/season", "/calendar", "/free-agents", "/schedule", "/standings", "/scores"]) revalidatePath(p);
  return { ok: true as const, preseasonMsg };
}

/** Admin: set (or clear, passing null) the real dates the "preseason" and "regular"
 *  phases begin — only used while the phase follows the calendar (Auto mode); a
 *  pinned phase ignores these entirely. Clearing a date falls back to the generated
 *  schedule's own first game, or the old fixed calendar-year default if there's no
 *  schedule yet. Playoffs isn't set here — it always follows the regular season's
 *  last scheduled game. See lib/calendar-server.ts resolvePhaseThresholds. */
export async function setPhaseDatesAction(preseasonAt: string | null, regularAt: string | null) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const parse = (iso: string | null) => (iso ? new Date(iso + "T00:00:00Z") : null);
  const pre = parse(preseasonAt), reg = parse(regularAt);
  if ((preseasonAt && isNaN(pre!.getTime())) || (regularAt && isNaN(reg!.getTime()))) {
    return { ok: false as const, error: "Invalid date." };
  }
  await prisma.leagueConfig.upsert({
    where: { id: 1 }, update: { preseasonPhaseAt: pre, regularPhaseAt: reg },
    create: { id: 1, preseasonPhaseAt: pre, regularPhaseAt: reg },
  });
  for (const p of ["/", "/admin/season", "/calendar", "/free-agents", "/schedule", "/standings", "/scores"]) revalidatePath(p);
  return { ok: true as const };
}

export async function importNhlApiAction() {
  const r = await importFromNhlApi(SEASON);
  revalidatePath("/admin/season");
  revalidatePath("/schedule");
  return r;
}

export async function importCsvAction(formData: FormData) {
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) return { imported: 0, days: 0, errors: ["No file selected."] };
  const text = await file.text();
  const r = await importCsvSchedule(text, SEASON);
  revalidatePath("/admin/season");
  revalidatePath("/schedule");
  return r;
}

export async function generatePreseasonAction(startISO?: string) {
  if (!(await isAdmin())) throw new Error("Only a league admin can generate the pre-season.");
  const start = startISO ? new Date(startISO + "T00:00:00.000Z") : undefined;
  const r = await generatePreseason(start && !isNaN(start.getTime()) ? start : undefined);
  revalidatePath("/admin/season");
  revalidatePath("/preseason");
  return { games: r.games, teams: r.teams, rounds: r.rounds, firstDate: r.firstDate.toISOString().slice(0, 10), lastDate: r.lastDate.toISOString().slice(0, 10) };
}

/** Admin: show/hide the pre-season schedule on the public /preseason page. Season
 *  Control's own preview always shows it to admins regardless of this flag. */
export async function setPreseasonPublicAction(pub: boolean) {
  if (!(await isAdmin())) throw new Error("Only a league admin can change this.");
  await prisma.leagueConfig.upsert({ where: { id: 1 }, update: { preseasonPublic: pub }, create: { id: 1, preseasonPublic: pub } });
  revalidatePath("/admin/season");
  revalidatePath("/preseason");
  return { preseasonPublic: pub };
}

export async function simPreseasonAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can simulate the pre-season.");
  const r = await playPreseason();
  revalidatePath("/admin/season");
  revalidatePath("/preseason");
  return r;
}

export async function generateScheduleAction(gamesPerTeam: number) {
  const r = await generateSchedule(SEASON, { gamesPerTeam: Math.max(2, gamesPerTeam) });
  await resetConditions();
  revalidatePath("/admin/season");
  return { games: r.games, gamesPerTeam: r.gamesPerTeam };
}

export async function playSeasonAction() {
  await aiGmDaily();            // AI GM sets tactics + cap-compliance for GM-less clubs
  await autoFillRosters("NHL"); // legal, cap-counted rosters before the run
  await fillAhlFromScratched();
  const r = await playScheduledGames({ season: SEASON, actor: await commissionerName() });
  await processFinances(SEASON, "NHL"); // ticket revenue in, salaries out
  revalidatePath("/admin/season");
  revalidatePath("/standings");
  revalidatePath("/schedule");
  revalidatePath("/finance");
  return { played: r.played };
}

export async function runPlayoffsAction() {
  const nhl = await runPlayoffs(SEASON, "NHL");
  await runPlayoffs(SEASON, "AHL");
  revalidatePath("/admin/season");
  revalidatePath("/playoffs");
  return { champion: nhl.championTeamId };
}

/** Day-by-day playoffs: seed the bracket and schedule round 1 on a chosen start day
 *  (2-day cadence → no team plays back-to-back). Advancing the league day plays it out
 *  and seeds each next round automatically. */
export async function startPlayoffsScheduledAction(startISO?: string) {
  if (!(await isAdmin())) throw new Error("Only a league admin can start the playoffs.");
  const d = startISO ? new Date(startISO + "T00:00:00.000Z") : undefined;
  const start = d && !isNaN(d.getTime()) ? d : undefined;
  const nhl = await startPlayoffs(SEASON, "NHL", start);
  await startPlayoffs(SEASON, "AHL", start);
  await prisma.leagueConfig.upsert({ where: { id: 1 }, update: { phaseOverride: "playoffs" }, create: { id: 1, phaseOverride: "playoffs" } });
  revalidatePath("/admin/season");
  revalidatePath("/playoffs");
  return { series: nhl.series, firstDate: nhl.firstDate.toISOString().slice(0, 10) };
}

/** Restart the season but KEEP the schedule: every game reverts to SCHEDULED with
 *  its results wiped (and all derived per-game stats deleted), playoffs cleared, and
 *  player conditions/injuries reset — so you can sim from day 1 again on the exact
 *  same fixtures. Rosters are left as-is. */
export async function restartSeasonAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can restart the season.");
  const games = await prisma.game.findMany({ where: { season: SEASON }, select: { id: true } });
  const ids = games.map((g) => g.id);
  if (ids.length) {
    await prisma.$transaction([
      prisma.playerGameStat.deleteMany({ where: { gameId: { in: ids } } }),
      prisma.goalieGameStat.deleteMany({ where: { gameId: { in: ids } } }),
      prisma.gameGoal.deleteMany({ where: { gameId: { in: ids } } }),
      prisma.gamePenalty.deleteMany({ where: { gameId: { in: ids } } }),
      prisma.gameEvent.deleteMany({ where: { gameId: { in: ids } } }),
    ]);
  }
  // drop playoff games + series entirely (they're recreated at playoff time)
  await prisma.game.deleteMany({ where: { season: SEASON, seriesId: { not: null } } });
  await prisma.playoffSeries.deleteMany({ where: { season: SEASON } });
  await prisma.gameAudit.deleteMany({ where: { season: SEASON } }); // clear the sim-integrity log for a fresh run
  // revert every remaining (regular-season) game to an unplayed SCHEDULED state
  await prisma.game.updateMany({
    where: { season: SEASON },
    data: {
      status: "SCHEDULED", homeGoals: null, awayGoals: null, homeShots: null, awayShots: null,
      homeGoalsByPeriod: [], awayGoalsByPeriod: [], homeShotsByPeriod: [], awayShotsByPeriod: [],
      homeXg: null, awayXg: null, homeHd: null, awayHd: null,
      homeOzPct: null, homeNzPct: null, homeDzPct: null, awayOzPct: null, awayNzPct: null, awayDzPct: null,
      homeShotSectors: [], awayShotSectors: [],
      homeTopShot: null, awayTopShot: null, homeTopShotBy: null, awayTopShotBy: null, homeAvgShot: null, awayAvgShot: null,
      homeSystem: Prisma.DbNull, awaySystem: Prisma.DbNull, endedIn: null, otPeriods: 0, winnerTeamId: null,
      seed: null, simCount: 0, lastSimBy: null, lastSimAt: null, playByPlay: Prisma.DbNull, shootout: Prisma.DbNull, playedAt: null,
    },
  });
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { phaseOverride: null } }).catch(() => {});
  await resetConditions(); // CON back to 100, clear injuries
  for (const p of ["/admin/season", "/standings", "/schedule", "/scores", "/stats/players", "/stats/goalies", "/playoffs", "/finance"]) revalidatePath(p);
  return { games: ids.length };
}

export async function resetSeasonAction() {
  const series = await prisma.playoffSeries.findMany({ where: { season: SEASON }, select: { id: true } });
  await prisma.game.deleteMany({ where: { season: SEASON } });
  if (series.length) await prisma.playoffSeries.deleteMany({ where: { season: SEASON } });
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { phaseOverride: null } }).catch(() => {}); // back to calendar-driven phase
  await resetConditions();
  revalidatePath("/admin/season");
  revalidatePath("/standings");
  revalidatePath("/schedule");
  revalidatePath("/playoffs");
}
