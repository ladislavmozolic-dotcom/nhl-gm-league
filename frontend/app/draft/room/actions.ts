"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { effectiveOrder, PICKS_PER_ROUND, LAST_BASE_PICK } from "@/lib/draft-order";
import { currentDraftYear } from "@/lib/draft-class-import";
import { currentDraftSourceWhere } from "@/lib/draft-source";
import { getLeagueDate } from "@/lib/calendar-server";

const POSITIONS = ["C", "LW", "RW", "D", "G"];

/** Allotted minutes for a pick: 20 for round 1 / any deferred retry, 30 for R2-7. */
function pickMinutes(round: number, deferred?: boolean) {
  return deferred || round === 1 ? 20 : 30;
}

// The active draft is whichever the league calendar points at — it rolls forward on
// its own each season (see currentDraftYear), so nothing here is pinned to a year.
async function getState(year: number) {
  let s = await prisma.draftState.findUnique({ where: { year } });
  if (!s) s = await prisma.draftState.create({ data: { year } });
  return s;
}

/** Advance the clock if the current pick's timer has expired: the missed club's
 *  pick is moved to the end of the draft (deferred) and the next club goes up.
 *  Safe to call from any viewer — it only acts when genuinely expired. */
export async function processDraftClockAction() {
  const YEAR = await currentDraftYear();
  const s = await getState(YEAR);
  if (s.status !== "LIVE" || !s.onClockAt) return { advanced: false };
  const order = await effectiveOrder(YEAR);
  const slot = order.find((p) => p.overallPick === s.currentPick);
  if (!slot) return { advanced: false };

  const minutes = pickMinutes(slot.round, slot.deferred);
  const deadline = new Date(s.onClockAt).getTime() + minutes * 60000;
  if (Date.now() < deadline) return { advanced: false }; // not expired yet

  // expired → defer scheduled picks to the end (a pick that was already deferred and
  // expires again is simply skipped), then put the next club on the clock.
  const lastScheduled = order.filter((p) => !p.deferred).reduce((m, p) => Math.max(m, p.overallPick), LAST_BASE_PICK);
  const willDefer = !slot.deferred && slot.overallPick <= lastScheduled;
  const priorDeferrals = await prisma.draftDeferral.count({ where: { year: YEAR } });
  const maxPick = lastScheduled + priorDeferrals + (willDefer ? 1 : 0);
  const nextPick = s.currentPick + 1;
  const done = nextPick > maxPick;

  // atomic guard against a race: only ONE concurrent caller advances this pick.
  const upd = await prisma.draftState.updateMany({
    where: { year: YEAR, currentPick: s.currentPick, status: "LIVE" },
    data: { currentPick: nextPick, onClockAt: done ? null : new Date(), status: done ? "DONE" : "LIVE" },
  });
  if (upd.count === 0) return { advanced: false }; // someone else already advanced
  if (willDefer) await prisma.draftDeferral.create({ data: { year: YEAR, round: slot.round, teamId: slot.pickerTeamId, sourcePick: slot.overallPick } });
  revalidatePath("/draft/room");
  return { advanced: true, deferred: willDefer };
}

/** A signed-in GM posts a chat message to the draft room. */
export async function postChatAction(text: string, channel = "draft") {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false, error: "Sign in as a GM to chat." };
  const clean = text.trim().slice(0, 500);
  if (!clean) return { ok: false, error: "Empty message." };
  const ch = channel === "lottery" ? "lottery" : "draft";
  const m = await prisma.chatMessage.create({ data: { channel: ch, teamId, text: clean } });
  return { ok: true, id: m.id };
}

/** Admin opens a round for picking. Round 1 opens only once the draft lottery for
 *  this year is committed; the clock resumes at the round's first unmade pick. */
export async function startRoundAction(round: number) {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  if (round < 1) return { ok: false, error: "Invalid round." };
  const YEAR = await currentDraftYear();
  if (round === 1) {
    const [lot, tcfg] = await Promise.all([
      prisma.draftLottery.count({ where: { year: YEAR } }),
      prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { draftTestMode: true } }),
    ]);
    // in test mode round 1 runs on a synthesized reverse-standings order (see draftOrder)
    if (lot === 0 && !tcfg?.draftTestMode) return { ok: false, error: "Draw the Draft Lottery first — it sets round 1." };
  }
  // the round's pick range comes from the order (base rounds are 32-wide; bonus
  // rounds 8+ are however many picks the admin awarded)
  const order = await effectiveOrder(YEAR);
  const roundPicks = order.filter((p) => p.round === round && !p.deferred).map((p) => p.overallPick).sort((a, b) => a - b);
  if (roundPicks.length === 0) return { ok: false, error: "That round has no picks yet." };
  const src = await currentDraftSourceWhere();
  const made = await prisma.draftProspect.count({ where: { draftYear: YEAR, draftedByTeamId: { not: null }, overallPick: { gte: roundPicks[0], lte: roundPicks[roundPicks.length - 1] }, ...src } });
  await getState(YEAR); // ensure the row exists
  const currentPick = roundPicks[Math.min(made, roundPicks.length - 1)];
  await prisma.draftState.update({ where: { year: YEAR }, data: { liveRound: round, status: "LIVE", currentPick, onClockAt: new Date() } });
  revalidatePath("/draft/room");
  return { ok: true };
}

/** The on-the-clock club's GM (or an admin) selects a prospect. */
export async function makePickAction(prospectId: number) {
  const YEAR = await currentDraftYear();
  const s = await getState(YEAR);
  if (s.status !== "LIVE") return { ok: false, error: "The draft isn't live." };

  const order = await effectiveOrder(YEAR);
  const slot = order.find((p) => p.overallPick === s.currentPick);
  if (!slot) return { ok: false, error: "Draft is complete." };
  if (!slot.deferred && slot.round !== s.liveRound) return { ok: false, error: "That pick isn't in the open round." };

  const admin = await isAdmin();
  const me = await getTeamSession();
  // testing: advance the board but don't write the player onto the team — and let ANY
  // signed-in GM make the pick (even off-turn) so everyone can rehearse the flow.
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true, draftTestMode: true } });
  const source = cfg?.rosterMode === "real" ? "real" : "profinhl";
  const testMode = !!cfg?.draftTestMode;
  if (!admin && me !== slot.pickerTeamId && !(testMode && me != null)) return { ok: false, error: "It's not your pick." };

  const prospect = await prisma.draftProspect.findUnique({ where: { id: prospectId }, select: { id: true, draftedByTeamId: true, draftYear: true, name: true, position: true } });
  if (!prospect || prospect.draftYear !== YEAR) return { ok: false, error: "Unknown prospect." };
  if (prospect.draftedByTeamId != null) return { ok: false, error: "Already drafted." };

  const nextPick = s.currentPick + 1;
  const deferralCount = await prisma.draftDeferral.count({ where: { year: YEAR } });
  const lastScheduled = order.filter((p) => !p.deferred).reduce((m, p) => Math.max(m, p.overallPick), LAST_BASE_PICK);
  const maxPick = lastScheduled + deferralCount;
  const nextSlot = order.find((p) => p.overallPick === nextPick);
  const done = nextPick > maxPick;
  // a round (base or bonus) finishes when the next scheduled pick is a new round → wait for the admin
  const roundDone = !slot.deferred && !done && nextPick <= lastScheduled && !!nextSlot && nextSlot.round !== slot.round;
  await prisma.$transaction([
    prisma.draftProspect.update({ where: { id: prospectId }, data: { draftedByTeamId: slot.pickerTeamId, overallPick: s.currentPick } }),
    // in test mode the pick shows on the board but the player is NOT written onto the
    // club (no Prospect row) — reset the board to re-run the draft with the same names.
    ...(testMode ? [] : [prisma.prospect.create({ data: { name: prospect.name, position: prospect.position, draftYear: YEAR, overallPick: s.currentPick, teamId: slot.pickerTeamId, source } })]),
    prisma.draftState.update({ where: { year: YEAR }, data: { currentPick: nextPick, onClockAt: (roundDone || done) ? null : new Date(), status: done ? "DONE" : roundDone ? "ROUND_DONE" : "LIVE" } }),
  ]);
  revalidatePath("/draft/room");
  return { ok: true, roundDone, done };
}

/** Admin: flip draft "test mode" — picks advance the board but don't write players
 *  onto teams. Handy while testing the draft flow without polluting rosters. */
export async function toggleDraftTestModeAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { draftTestMode: true } });
  const v = !cfg?.draftTestMode;
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { draftTestMode: v } });
  revalidatePath("/draft/room");
  return { ok: true as const, testMode: v };
}

/** Admin: reset the draft board for the current year — un-draft every prospect and
 *  rewind the clock so the same names can be re-drafted. Does NOT delete any Prospect
 *  rows already written onto teams (clear those via Roster tools if needed). */
export async function resetDraftBoardAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const YEAR = await currentDraftYear();
  const un = await prisma.draftProspect.updateMany({ where: { draftYear: YEAR }, data: { draftedByTeamId: null } });
  await prisma.draftDeferral.deleteMany({ where: { year: YEAR } });
  await prisma.chatMessage.deleteMany({ where: { channel: { contains: "draft" } } }); // clear the draft chat too
  await prisma.draftState.upsert({ where: { year: YEAR }, create: { year: YEAR, currentPick: 1, status: "ROUND_DONE" }, update: { currentPick: 1, status: "ROUND_DONE", onClockAt: null } });
  revalidatePath("/draft/room");
  return { ok: true as const, unDrafted: un.count };
}

/** The on-the-clock GM drafts a player who ISN'T on the scouting board — a custom pick.
 *  The player must be ≤ 23 on draft day (GM supplies the birth date) and an EP link;
 *  he's added to prospects flagged for admin verification, and the admin is notified. */
export async function makeOffBoardPickAction(input: { name: string; birthDate: string; position: string; epLink: string }) {
  const YEAR = await currentDraftYear();
  const s = await getState(YEAR);
  if (s.status !== "LIVE") return { ok: false, error: "The draft isn't live." };

  const order = await effectiveOrder(YEAR);
  const slot = order.find((p) => p.overallPick === s.currentPick);
  if (!slot) return { ok: false, error: "Draft is complete." };
  if (!slot.deferred && slot.round !== s.liveRound) return { ok: false, error: "That pick isn't in the open round." };

  const admin = await isAdmin();
  const me = await getTeamSession();
  const testCfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { draftTestMode: true } });
  const testMode = !!testCfg?.draftTestMode; // any signed-in GM may add off-board picks while rehearsing
  if (!admin && me !== slot.pickerTeamId && !(testMode && me != null)) return { ok: false, error: "It's not your pick." };

  const name = input.name?.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!name || name.length < 2) return { ok: false, error: "Enter the player's full name." };
  const position = POSITIONS.includes(input.position) ? input.position : "C";
  const link = input.epLink?.trim() || "";
  if (link && !/^https?:\/\//i.test(link)) return { ok: false, error: "The EP link must be a full https:// URL." };

  // age gate: must be no older than 23 on draft day (the league date)
  const bd = new Date(`${input.birthDate}T00:00:00Z`);
  if (isNaN(bd.getTime())) return { ok: false, error: "Enter a valid birth date." };
  const draftDay = await getLeagueDate();
  if (bd.getTime() > draftDay.getTime()) return { ok: false, error: "Birth date can't be in the future." };
  const turns24 = new Date(Date.UTC(bd.getUTCFullYear() + 24, bd.getUTCMonth(), bd.getUTCDate()));
  if (draftDay.getTime() >= turns24.getTime()) return { ok: false, error: "Player is over 23 on draft day — not eligible." };

  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const source = cfg?.rosterMode === "real" ? "real" : "profinhl";
  const parts = name.split(" ");
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || parts[0];
  const picker = await prisma.team.findUnique({ where: { id: slot.pickerTeamId }, select: { code: true } });

  const nextPick = s.currentPick + 1;
  const deferralCount = await prisma.draftDeferral.count({ where: { year: YEAR } });
  const lastScheduled = order.filter((p) => !p.deferred).reduce((m, p) => Math.max(m, p.overallPick), LAST_BASE_PICK);
  const maxPick = lastScheduled + deferralCount;
  const nextSlot = order.find((p) => p.overallPick === nextPick);
  const done = nextPick > maxPick;
  const roundDone = !slot.deferred && !done && nextPick <= lastScheduled && !!nextSlot && nextSlot.round !== slot.round;
  await prisma.$transaction([
    prisma.draftProspect.create({ data: {
      draftYear: YEAR, source, firstName, lastName, name, position, birthDate: input.birthDate,
      category: position === "G" ? 3 : 1, ov: 50, potential: 65,
      offBoard: true, epLink: link || null, verified: false,
      draftedByTeamId: slot.pickerTeamId, overallPick: s.currentPick,
    } }),
    prisma.prospect.create({ data: { name, position, draftYear: YEAR, overallPick: s.currentPick, teamId: slot.pickerTeamId, source } }),
    prisma.draftState.update({ where: { year: YEAR }, data: { currentPick: nextPick, onClockAt: (roundDone || done) ? null : new Date(), status: done ? "DONE" : roundDone ? "ROUND_DONE" : "LIVE" } }),
    prisma.transaction.create({ data: { type: "DRAFT_OFF_BOARD", message: `${picker?.code ?? "A club"} used pick #${s.currentPick} on off-board player ${name} (b. ${input.birthDate}, ${position}) — admin please verify eligibility.${link ? ` EP: ${link}` : ""}` } }),
  ]);
  revalidatePath("/draft/room");
  return { ok: true, roundDone, done };
}

/** Admin marks an off-board pick verified (eligible). */
export async function verifyOffBoardPickAction(prospectId: number) {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  await prisma.draftProspect.update({ where: { id: prospectId }, data: { verified: true } });
  revalidatePath("/draft/room");
  return { ok: true };
}

/** Admin awards a bonus pick to a club in an extra round (8, 9, …). */
export async function addBonusPickAction(input: { round: number; teamId: number; reason?: string }) {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  if (!Number.isInteger(input.round) || input.round < 8 || input.round > 20) return { ok: false, error: "Bonus rounds are 8 and up." };
  if (!Number.isInteger(input.teamId)) return { ok: false, error: "Pick a club." };
  const YEAR = await currentDraftYear();
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const source = cfg?.rosterMode === "real" ? "real" : "profinhl";
  await prisma.draftBonusPick.create({ data: { year: YEAR, round: input.round, teamId: input.teamId, reason: input.reason?.trim().slice(0, 120) || null, source } });
  revalidatePath("/draft/room");
  return { ok: true };
}

/** Admin removes a bonus pick. */
export async function removeBonusPickAction(id: number) {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  await prisma.draftBonusPick.delete({ where: { id } });
  revalidatePath("/draft/room");
  return { ok: true };
}

/** Admin randomises the selection order of a bonus round after all its picks are in. */
export async function randomiseBonusRoundAction(round: number) {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  const YEAR = await currentDraftYear();
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const bonusSource = cfg?.rosterMode === "real" ? { source: "real" } : { OR: [{ source: null }, { source: "profinhl" }] };
  const picks = await prisma.draftBonusPick.findMany({ where: { year: YEAR, round, ...bonusSource }, select: { id: true } });
  if (picks.length === 0) return { ok: false, error: "No picks in that round yet." };
  const ids = picks.map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } // Fisher-Yates
  await prisma.$transaction(ids.map((id, idx) => prisma.draftBonusPick.update({ where: { id }, data: { seq: idx + 1 } })));
  revalidatePath("/draft/room");
  return { ok: true, count: ids.length };
}
