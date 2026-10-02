"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payWeeklyPicksWinners, paySeasonTop3, getBank, postEntry, moveTeamBank, enforceLeagueDay, recomputeCapPenalties } from "@/lib/league-bank-server";
import { CURRENT_SEASON_START } from "@/lib/finance";

async function guard() {
  if (!(await isAdmin())) throw new Error("Commissioner only");
}
const num = (v: FormDataEntryValue | null, d = 0) => { const n = Number(String(v ?? "").replace(/[\s,]/g, "")); return Number.isFinite(n) ? n : d; };
const done = () => { revalidatePath("/admin/league-bank"); revalidatePath("/salary-cap"); };

export async function saveBankSettings(fd: FormData) {
  await guard();
  await getBank();
  const start = String(fd.get("enforcementStart") ?? "").trim();
  await prisma.leagueBank.update({ where: { id: 1 }, data: {
    enforcementEnabled: fd.get("enforcementEnabled") === "on",
    enforcementStart: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null,
    nhlRosterFine: Math.max(0, num(fd.get("nhlRosterFine"))),
    ahlRosterFine: Math.max(0, num(fd.get("ahlRosterFine"))),
    capFinePerDay: Math.max(0, num(fd.get("capFinePerDay"))),
    capPenaltyMultiplier: Math.max(0, num(fd.get("capPenaltyMultiplier"), 2)),
    capPenaltyMax: Math.max(0, num(fd.get("capPenaltyMax"), 10000000)),
    picksWeeklyPrize: Math.max(0, num(fd.get("picksWeeklyPrize"), 200000)),
    picksPrize1: Math.max(0, num(fd.get("picksPrize1"), 3000000)),
    picksPrize2: Math.max(0, num(fd.get("picksPrize2"), 1500000)),
    picksPrize3: Math.max(0, num(fd.get("picksPrize3"), 750000)),
    autoPickPayouts: fd.get("autoPickPayouts") === "on",
    capAccumulate: fd.get("capAccumulate") === "peak" ? "peak" : "sum",
    finesForAiClubs: fd.get("finesForAiClubs") === "on",
    suspensionToBank: fd.get("suspensionToBank") === "on",
  } });
  await recomputeCapPenalties();
  done();
}

/** Bonus / pick-em payout to a club (league → club) or a manual fine (club → league). */
export async function bankTransfer(fd: FormData) {
  await guard();
  const kind = String(fd.get("kind"));
  const teamId = num(fd.get("teamId"));
  const amount = Math.round(Math.abs(num(fd.get("amount"))));
  const note = String(fd.get("note") ?? "").trim().slice(0, 300);
  if (!amount) throw new Error("Enter an amount");
  if (kind === "INCOME" || kind === "ADJUSTMENT") { // money straight into / out of the pot, no club involved
    await postEntry({ kind, amount: fd.get("sign") === "out" ? -amount : amount, note: note || kind });
  } else {
    if (!teamId) throw new Error("Pick a club");
    if (kind === "BONUS" || kind === "PAYOUT") {
      await postEntry({ kind, amount: -amount, teamId, note: note || kind });
      await moveTeamBank(teamId, amount);
    } else if (kind === "FINE_MANUAL") {
      await postEntry({ kind: "FINE_PLAYER", amount, teamId, note: note || "Commissioner fine" });
      await moveTeamBank(teamId, -amount);
    } else throw new Error("Unknown kind");
  }
  done();
}

export async function runEnforcementNow() {
  await guard();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bratislava" });
  await enforceLeagueDay(day, { force: true });
  done();
}

export async function adjustCapPenalty(fd: FormData) {
  await guard();
  const teamId = num(fd.get("teamId"));
  if (!teamId) throw new Error("Pick a club");
  const kind = fd.get("kind") === "floor" ? "floor" : "ceiling";
  const adj = Math.round(num(fd.get("manualAdj")));
  const waived = fd.get("waived") === "on";
  if (kind === "floor") {
    await prisma.teamCapPenalty.upsert({
      where: { teamId_sourceSeasonStart: { teamId, sourceSeasonStart: CURRENT_SEASON_START } },
      update: { floorManualAdj: adj, floorWaived: waived },
      create: { teamId, sourceSeasonStart: CURRENT_SEASON_START, appliesSeasonStart: CURRENT_SEASON_START + 1, floorManualAdj: adj, floorWaived: waived },
    });
  } else {
    await prisma.teamCapPenalty.upsert({
      where: { teamId_sourceSeasonStart: { teamId, sourceSeasonStart: CURRENT_SEASON_START } },
      update: { manualAdj: adj, waived },
      create: { teamId, sourceSeasonStart: CURRENT_SEASON_START, appliesSeasonStart: CURRENT_SEASON_START + 1, manualAdj: adj, waived },
    });
  }
  done();
}

export async function payPicksWeek(fd: FormData) {
  await guard();
  const week = String(fd.get("week") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error("Week = Monday date YYYY-MM-DD");
  await payWeeklyPicksWinners(week);
  done();
}

export async function payPicksSeason(fd: FormData) {
  await guard();
  const ids = [num(fd.get("p1")), num(fd.get("p2")), num(fd.get("p3"))] as [number, number, number];
  if (ids.some((i) => !i) || new Set(ids).size !== 3) throw new Error("Pick three different clubs");
  await paySeasonTop3(ids);
  done();
}
