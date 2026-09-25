"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REGULAR_SEASON } from "@/lib/phase";
import { bratislavaLocalToUtc } from "@/lib/trade-deadline";
import {
  runAllStar, clearResults, closeNominations, notifyCoaches, sendNominationMessages, autoFillTeams, setTeamMeta, DIVS, type DivKey,
} from "@/lib/all-star-server";

export type EventForm = {
  id?: number | null; title: string; eventAt: string; nomOpensAt: string; nomClosesAt: string; coachDeadlineAt: string;
  lowDefense: boolean; mvpBonusRound: number;
};

const refresh = () => { revalidatePath("/admin/all-star"); revalidatePath("/all-star"); revalidatePath("/all-star/coach"); };
async function guard() { if (!(await isAdmin())) throw new Error("Admin only."); }
const wrap = async (fn: () => Promise<unknown>) => { try { await guard(); await fn(); refresh(); return { ok: true as const }; } catch (e) { return { ok: false as const, error: (e as Error).message }; } };

export async function saveAllStarEventAction(f: EventForm) {
  await guard();
  const eventAt = bratislavaLocalToUtc(f.eventAt);
  const opens = f.nomOpensAt ? bratislavaLocalToUtc(f.nomOpensAt) : null;
  const closes = f.nomClosesAt ? bratislavaLocalToUtc(f.nomClosesAt) : null;
  const coach = f.coachDeadlineAt ? bratislavaLocalToUtc(f.coachDeadlineAt) : null;
  if (!eventAt) return { ok: false as const, error: "Set the game day and time." };
  if (!opens || !closes) return { ok: false as const, error: "Set when nominations open and close (or use the standard schedule)." };
  const coachAt = coach ?? eventAt;
  if (!(opens < closes && closes < coachAt && coachAt <= eventAt)) return { ok: false as const, error: "Order must be: nominations open < nominations close < coaches' deadline ≤ game time." };
  const round = Math.round(f.mvpBonusRound);
  if (round !== 0 && (round < 8 || round > 20)) return { ok: false as const, error: "MVP bonus round: 8 or later (0 = no pick)." };
  const data = { title: f.title.trim().slice(0, 80) || "UNHL All-Star Weekend", eventAt, votingOpensAt: opens, votingClosesAt: closes, coachDeadlineAt: coach, lowDefense: !!f.lowDefense, mvpBonusRound: round };
  const ev = f.id
    ? await prisma.allStarEvent.update({ where: { id: f.id }, data })
    : await prisma.allStarEvent.create({ data: { ...data, season: REGULAR_SEASON } });
  refresh();
  return { ok: true as const, id: ev.id };
}

export async function setAllStarTeamAction(eventId: number, div: DivKey, name: string, coachTeamId: number | null) {
  if (!DIVS.some((d) => d.key === div)) return { ok: false as const, error: "Unknown team." };
  return wrap(() => setTeamMeta(eventId, div, { name, coachTeamId }));
}
export async function sendNominationsNowAction(eventId: number) { return wrap(() => sendNominationMessages(eventId)); }
export async function closeNominationsNowAction(eventId: number) {
  return wrap(async () => {
    await closeNominations(eventId);
    const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
    if (ev) await notifyCoaches(ev);
  });
}
export async function autoFillTeamAction(eventId: number, div: DivKey) { return wrap(() => autoFillTeams(eventId, div)); }
export async function runAllStarNowAction(eventId: number) { return wrap(() => runAllStar(eventId)); }
export async function resetAllStarResultsAction(eventId: number) { return wrap(() => clearResults(eventId)); }
export async function deleteAllStarEventAction(eventId: number) {
  return wrap(async () => {
    const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
    if (ev?.mvpBonusPickId) await prisma.draftBonusPick.deleteMany({ where: { id: ev.mvpBonusPickId } });
    await prisma.allStarEvent.delete({ where: { id: eventId } });
  });
}
