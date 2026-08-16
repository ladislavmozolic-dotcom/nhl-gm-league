"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateSchedule } from "@/lib/sim/schedule";
import { playScheduledGames, resetConditions, updateInjuryCon } from "@/lib/sim/season";
import { runPlayoffs } from "@/lib/sim/playoffs";
import { importCsvSchedule, importFromNhlApi } from "@/lib/sim/csv-schedule";
import { processFinances } from "@/lib/finance-server";
import { archiveSeason } from "@/lib/awards";
import { isAdmin } from "@/lib/auth";
import { commissionerName } from "@/lib/audit-server";
import { loadSettings } from "@/lib/sim/settings";
import { autoFillRosters } from "@/lib/roster-fill";
import { getLeagueDate } from "@/lib/calendar-server";
import { addDays, utcDay, phaseFor, effectivePhase, PHASES, seasonOpen, defaultLeagueDate, frenzyRound, roundForDate } from "@/lib/calendar";
import { processWaivers } from "@/lib/waivers-server";
import { resolveFrenzy, processRoundEnd } from "@/app/free-agents/actions";
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

/** Admin: advance the league clock by one calendar day. If games are scheduled
 *  that date, they are played; a regular-season off-day recovers CON; the
 *  off-season simply moves the date forward (Free Agent Frenzy lives here). */
export async function advanceLeagueDayAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can advance the league day.");
  const cur = await getLeagueDate();
  const cfg0 = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true } });
  const ph = (d: Date) => effectivePhase(d, cfg0?.phaseOverride); // admin can pin the phase manually
  const next = addDays(cur, 1);
  const start = utcDay(next), end = addDays(next, 1);
  const dayGames = await prisma.game.findMany({
    where: { season: SEASON, status: "SCHEDULED", gameDate: { gte: start, lt: end } },
    select: { round: true }, orderBy: { round: "asc" },
  });
  let played = 0;
  if (dayGames.length && dayGames[0].round != null) {
    await autoFillRosters("NHL");
    const r = await playScheduledGames({ season: SEASON, round: dayGames[0].round, actor: await commissionerName() });
    played = r.played;
    await processFinances(SEASON, "NHL");
  } else if (ph(next) === "regular" || ph(next) === "playoffs") {
    await recoverOneDay();
  }
  // ice-time promise check (self-gates to the regular season past 1/3)
  const promises = await checkPromises();
  // waivers: resolve any whose one-day window closed (claimed by priority, else clear to AHL)
  const waivers = await processWaivers(roundForDate(next));
  // Free Agent Frenzy round transitions (3 weekly rounds). Crossing a week
  // boundary inside the window runs counters / shortlisting; leaving the window
  // (end of round 3) signs everyone's best offer.
  let signed = 0;
  if (ph(cur) === "frenzy" && ph(next) !== "frenzy") {
    const r = await resolveFrenzy();
    signed = r.signed;
  } else if (ph(cur) === "frenzy" && ph(next) === "frenzy" && frenzyRound(cur) !== frenzyRound(next)) {
    await processRoundEnd(frenzyRound(cur));
  }
  // opening-day cap compliance: the +10% summer cushion expires — every club must
  // now sit under the strict ceiling. Non-compliant clubs get a public warning.
  let capOffenders = 0;
  if (ph(cur) !== "regular" && ph(next) === "regular") {
    const offenders = await leagueCapCompliance("regular");
    capOffenders = offenders.filter((o) => o.over > 0).length;
    for (const o of offenders) {
      if (o.over > 0) await prisma.transaction.create({ data: { type: "CAP_WARNING", message: `${o.code} is over the salary cap by ${money(o.over)} on opening day — must shed salary to be compliant.` } });
    }
  }
  await prisma.leagueConfig.upsert({
    where: { id: 1 }, update: { leagueDate: next }, create: { id: 1, leagueDate: next },
  });
  for (const p of ["/calendar", "/schedule", "/standings", "/scores", "/admin/season", "/finance", "/free-agents", "/signings", "/waivers", "/"]) revalidatePath(p);
  return { date: next, phase: ph(next), played, signed, warned: promises.warned, requested: promises.requested, capOffenders, waiverClaims: waivers.claimed, waiverClears: waivers.cleared };
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
  return { ok: true, date: utcDay(d), phase: phaseFor(d) };
}

/** Admin: (re)start the league clock at July 1 — the Free Agent Frenzy open. */
export async function startLeagueClockAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can start the league clock.");
  const d = seasonOpen();
  await prisma.leagueConfig.upsert({
    where: { id: 1 }, update: { leagueDate: d }, create: { id: 1, leagueDate: d },
  });
  for (const p of ["/calendar", "/schedule", "/admin/season", "/free-agents"]) revalidatePath(p);
  return { date: d, phase: phaseFor(d) };
}

/** Admin: durably promote farm players onto any NHL club short of 12F/6D/2G, so
 *  they count against the cap and stay until the GM sends them down. */
export async function autoFillRostersAction() {
  if (!(await isAdmin())) throw new Error("Only a league admin can auto-fill rosters.");
  const filled = await autoFillRosters("NHL");
  for (const p of ["/teams", "/finance", "/admin/season"]) revalidatePath(p);
  return { teams: filled.length, promoted: filled.reduce((t, x) => t + x.f + x.d + x.g, 0), detail: filled };
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
  await autoFillRosters("NHL"); // ensure every club owns a legal roster (durable, counts to cap)
  const r = await playScheduledGames({ season: SEASON, round: next.round, actor: await commissionerName() });
  await processFinances(SEASON, "NHL");
  for (const p of ["/schedule", "/standings", "/scores", "/stats/players", "/admin/season", "/finance"]) revalidatePath(p);
  return { played: r.played, round: next.round, date: next.gameDate, done: false };
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

export async function archiveSeasonAction() {
  const nhl = await archiveSeason(SEASON, "NHL");
  await archiveSeason(SEASON, "AHL");
  revalidatePath("/admin/season");
  revalidatePath("/history");
  return { champion: nhl.championTeamId, awards: nhl.awards.length };
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

export async function generateScheduleAction(gamesPerTeam: number) {
  const r = await generateSchedule(SEASON, { gamesPerTeam: Math.max(2, gamesPerTeam) });
  await resetConditions();
  revalidatePath("/admin/season");
  return { games: r.games, gamesPerTeam: r.gamesPerTeam };
}

export async function playSeasonAction() {
  await autoFillRosters("NHL"); // legal, cap-counted rosters before the run
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
