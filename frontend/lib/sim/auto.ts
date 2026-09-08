// Automatic daily simulation. A scheduler (instrumentation.ts) calls
// runAutoSimIfDue() periodically; at the configured Bratislava time it plays
// the next unplayed day of games, once per calendar day.

import { prisma } from "../prisma";
import { playScheduledGames } from "./season";
import { processFinances } from "../finance-server";
import { getLeagueDate, computePhase } from "../calendar-server";
import { addDays, frenzyRound, frenzyDay } from "../calendar";

const SEASON = "2026-27";
const FRENZY_ROUND_MS = 7 * 86_400_000;

/** Checked on every scheduler tick (unlike runAutoSimIfDue, which only fires
 *  once a day at the configured sim time) — a FORCE-opened Frenzy round (faOpen,
 *  outside the real July calendar window) runs on its own real 7-day clock
 *  (LeagueConfig.frenzyRoundStartedAt), independent of the daily calendar tick
 *  that advances a calendar-driven Frenzy. It needs checking this often so it
 *  actually closes close to the instant the round-close countdown promises,
 *  instead of drifting to the next daily sim tick. A no-op for a calendar-
 *  driven Frenzy (frenzyRoundStartedAt stays null there — see its schema
 *  comment) or when the market isn't force-opened at all. */
export async function checkFrenzyRoundCloseIfDue() {
  const cfg = await prisma.leagueConfig.findUnique({
    where: { id: 1 }, select: { faOpen: true, frenzyRoundStartedAt: true, frenzyForcedRound: true },
  });
  if (!cfg?.faOpen || !cfg.frenzyRoundStartedAt) return { closed: false as const };
  if (Date.now() - cfg.frenzyRoundStartedAt.getTime() < FRENZY_ROUND_MS) return { closed: false as const };

  const round = cfg.frenzyForcedRound;
  const { resolveFrenzy, processRoundEnd } = await import("../../app/free-agents/actions");
  if (round >= 3) {
    // final week's 7 days are up — resolve standing offers and close the market,
    // same as leaving the real July window would.
    const r = await resolveFrenzy();
    await prisma.leagueConfig.update({ where: { id: 1 }, data: { faOpen: false, frenzyRoundStartedAt: null, frenzyForcedRound: 1 } });
    console.log(`[auto-frenzy] force-opened market resolved after round 3 — ${r.signed} signed`);
    return { closed: true as const, finalClose: true as const, signed: r.signed };
  }
  await processRoundEnd(round);
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { frenzyRoundStartedAt: new Date(), frenzyForcedRound: round + 1 } });
  console.log(`[auto-frenzy] force-opened round ${round} closed automatically`);
  return { closed: true as const, finalClose: false as const, round };
}

/** Checked on every scheduler tick, same as checkFrenzyRoundCloseIfDue above —
 *  a player who got at least one offer when a round closed is on his OWN
 *  real-time FRENZY_DECISION_DAYS-day clock (Player.faDecisionAt, set by
 *  processRoundEnd), independent of the weekly round timer entirely. This
 *  needs the same frequent, real-timestamp check so the Agent settles him
 *  close to the actual deadline instead of drifting to the next daily tick.
 *  Gated on faOpen: resolveInSeasonWindows (the separate regular-season/
 *  playoffs UFA market) reuses these exact same Player fields for its own
 *  7-day-collect/3-day-match cycle — without this gate, a player mid-way
 *  through THAT window would also get swept up here on the very next tick
 *  and double-resolved. Frenzy force-open and the in-season market are
 *  mutually exclusive in normal operation (faOpen is cleared before regular
 *  season begins), so this keeps the two mechanisms from ever colliding. */
export async function checkFrenzyDecisionsIfDue() {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { faOpen: true } });
  if (!cfg?.faOpen) return { signed: 0, unsigned: 0 };
  const { resolveFrenzyDecisions } = await import("../../app/free-agents/actions");
  const r = await resolveFrenzyDecisions(new Date());
  if (r.signed || r.unsigned) console.log(`[auto-frenzy] decision windows resolved — ${r.signed} signed, ${r.unsigned} stayed unsigned`);
  return r;
}

/** Off-season only: advance the league clock one day and run any frenzy-round
 *  transition it crosses (starts each bid player's individual decision window
 *  at a weekly boundary) and resolve any decision window that's since
 *  elapsed. Calendar-driven, once-daily — coarser than the force-opened
 *  path's 60-second real-time check (checkFrenzy*IfDue, above), which is the
 *  active path today, but still correct on its own once-a-day cadence. The
 *  regular season is driven by playNextSimDay, so this is a no-op during
 *  regular / playoffs. */
export async function advanceFrenzyDay() {
  const cur = await getLeagueDate();
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true } });
  const phCur = await computePhase(cur, cfg?.phaseOverride);
  if (phCur === "regular" || phCur === "playoffs") return { advanced: false as const };
  const next = addDays(cur, 1);
  const phNext = await computePhase(next, cfg?.phaseOverride);
  const { resolveFrenzy, processRoundEnd, resolveFrenzyDecisions } = await import("../../app/free-agents/actions");
  let signed = 0, roundEnded = 0, osSigned = 0;
  // individual decision windows (set by a PRIOR processRoundEnd call) resolve
  // on this same once-daily calendar tick — coarser than the force-opened
  // path's 60-second check, but still correct: a window that elapsed since
  // yesterday's tick gets picked up today.
  signed += (await resolveFrenzyDecisions(new Date())).signed;
  // offer sheets are decided by the commissioner-set day — resolve them once, as
  // the clock crosses that day (or leaves the frenzy earlier).
  const { loadSettings } = await import("../sim/settings");
  const osDay = (await loadSettings()).osDecisionDay;
  if (phCur === "frenzy" && frenzyDay(cur) <= osDay && (frenzyDay(next) > osDay || phNext !== "frenzy")) {
    const { resolveOfferSheets } = await import("../offer-sheet-server");
    osSigned = (await resolveOfferSheets()).signed;
  }
  if (phCur === "frenzy" && phNext !== "frenzy") { signed = (await resolveFrenzy()).signed; }
  else if (phCur === "frenzy" && phNext === "frenzy" && frenzyRound(cur) !== frenzyRound(next)) { await processRoundEnd(frenzyRound(cur)); roundEnded = frenzyRound(cur); }
  await prisma.leagueConfig.upsert({ where: { id: 1 }, update: { leagueDate: next }, create: { id: 1, leagueDate: next } });
  return { advanced: true as const, date: next, signed, roundEnded, osSigned };
}

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
  // call up from the farm first — any club short of a legal 12F/6D/2G gets its
  // best available AHL players promoted before the next game (no double-shifting).
  const { autoFillRosters } = await import("../roster-fill");
  const { aiGmDaily } = await import("../ai-gm");
  await aiGmDaily();            // AI GM sets tactics + cap-compliance for GM-less clubs
  await autoFillRosters("NHL");
  const r = await playScheduledGames({ season: SEASON, round: next.round, actor: "Auto-sim" });
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
  if (res.played) { console.log(`[auto-sim] ${date}: played round ${res.round} (${res.played} games)`); return { ran: true, ...res }; }

  // no games to play → off-season: advance the frenzy clock a day (auto-closes each
  // round after 7 days and signs at the window close).
  const fr = await advanceFrenzyDay();
  if (fr.advanced) console.log(`[auto-sim] ${date}: off-season day → ${fr.date?.toISOString?.().slice(0, 10)}${fr.roundEnded ? ` (closed frenzy round ${fr.roundEnded})` : ""}${fr.signed ? ` (${fr.signed} signed)` : ""}`);
  return { ran: true, ...res, frenzy: fr };
}
