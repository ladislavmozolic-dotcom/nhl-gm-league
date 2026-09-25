"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { REGULAR_SEASON } from "@/lib/phase";
import { bratislavaLocalToUtc } from "@/lib/trade-deadline";
import { buildRosters, runAllStar, type Rosters, type Side, type Slot } from "@/lib/all-star-server";

export type EventForm = {
  id?: number | null; title: string; eventAt: string; votingOpensAt: string; votingClosesAt: string;
  teamAName: string; teamBName: string; fanWeightPct: number; lowDefense: boolean;
};

const refresh = () => { revalidatePath("/admin/all-star"); revalidatePath("/all-star"); };
const guard = async () => { if (!(await isAdmin())) throw new Error("Admin only."); };

export async function saveAllStarEventAction(f: EventForm) {
  await guard();
  const eventAt = bratislavaLocalToUtc(f.eventAt);
  const opens = f.votingOpensAt ? bratislavaLocalToUtc(f.votingOpensAt) : null;
  const closes = f.votingClosesAt ? bratislavaLocalToUtc(f.votingClosesAt) : null;
  if (!eventAt) return { ok: false as const, error: "Set the event date and time." };
  if ((opens && !closes) || (!opens && closes)) return { ok: false as const, error: "Set both voting open and close, or neither." };
  if (opens && closes && !(opens < closes && closes <= eventAt)) return { ok: false as const, error: "Voting must open before it closes, and close by the event." };
  const data = {
    title: f.title.trim().slice(0, 80) || "UNHL All-Star Weekend", eventAt, votingOpensAt: opens, votingClosesAt: closes,
    teamAName: f.teamAName.trim().slice(0, 40) || "Eastern All-Stars", teamBName: f.teamBName.trim().slice(0, 40) || "Western All-Stars",
    fanWeightPct: Math.max(0, Math.min(100, Math.round(f.fanWeightPct))), lowDefense: !!f.lowDefense,
  };
  const ev = f.id
    ? await prisma.allStarEvent.update({ where: { id: f.id }, data })
    : await prisma.allStarEvent.create({ data: { ...data, season: REGULAR_SEASON } });
  refresh();
  return { ok: true as const, id: ev.id };
}

export async function buildRostersAction(eventId: number) {
  await guard();
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev) return { ok: false as const, error: "Not found." };
  await buildRosters(ev);
  refresh();
  return { ok: true as const };
}

export async function editRosterAction(eventId: number, side: Side, slot: Slot, op: "add" | "remove", playerId: number) {
  await guard();
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev?.rosters) return { ok: false as const, error: "Build the rosters first." };
  const r = ev.rosters as Rosters;
  const all = new Set((["A", "B"] as const).flatMap((s) => [...r[s].F, ...r[s].D, ...r[s].G]));
  if (op === "add") {
    if (all.has(playerId)) return { ok: false as const, error: "He's already an All-Star." };
    const p = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
    if (!p) return { ok: false as const, error: "Player not found." };
    r[side][slot].push(playerId);
  } else {
    r[side][slot] = r[side][slot].filter((id) => id !== playerId);
    r[side].starters = r[side].starters.filter((id) => id !== playerId);
  }
  await prisma.allStarEvent.update({ where: { id: eventId }, data: { rosters: r as object } });
  refresh();
  return { ok: true as const };
}

export async function runAllStarNowAction(eventId: number) {
  await guard();
  try { await runAllStar(eventId); } catch (e) { return { ok: false as const, error: (e as Error).message }; }
  refresh();
  return { ok: true as const };
}

/** Clear the results (keeps rosters + votes) so the event can be re-run. */
export async function resetAllStarResultsAction(eventId: number) {
  await guard();
  await prisma.allStarEvent.update({ where: { id: eventId }, data: { skills: Prisma.DbNull, game: Prisma.DbNull, status: "SCHEDULED", resultsPublished: false } });
  refresh();
  return { ok: true as const };
}

export async function deleteAllStarEventAction(eventId: number) {
  await guard();
  await prisma.allStarEvent.delete({ where: { id: eventId } });
  refresh();
  return { ok: true as const };
}
