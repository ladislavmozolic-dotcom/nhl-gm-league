"use server";

import { revalidatePath } from "next/cache";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  latestEvent, phaseOf, leaguePlayers, nominations, submitNomination, submitLineup, teamsOf,
  NOMINATE, type AsRoster, type DivKey, type Lineup, type Slot,
} from "@/lib/all-star-server";

export type NominationFormData = {
  eventId: number; title: string; open: boolean; closesAt: string | null; phase: string;
  teamName: string; players: { id: number; name: string; slot: Slot; line: string; hurt: boolean }[];
  picks: AsRoster; auto: boolean; submitted: boolean;
} | { error: string };

/** Everything the nomination form needs for the signed-in GM's club. */
export async function nominationFormAction(): Promise<NominationFormData> {
  const teamId = await getTeamSession();
  if (teamId == null) return { error: "Sign in as a GM to nominate." };
  const ev = await latestEvent();
  if (!ev) return { error: "No All-Star event is scheduled." };
  const [all, noms, team] = await Promise.all([leaguePlayers(), nominations(ev.id), prisma.team.findUnique({ where: { id: teamId }, select: { name: true } })]);
  const mine = noms.get(teamId);
  const ph = phaseOf(ev);
  return {
    eventId: ev.id, title: ev.title, open: ph === "nominations", closesAt: ev.votingClosesAt?.toISOString() ?? null, phase: ph,
    teamName: team?.name ?? "", players: all.filter((p) => p.teamId === teamId).sort((a, b) => b.perf - a.perf).map((p) => ({ id: p.id, name: p.name, slot: p.slot, line: p.line, hurt: p.hurt })),
    picks: mine ? { F: mine.F, D: mine.D, G: mine.G } : { F: [], D: [], G: [] }, auto: !!mine?.auto, submitted: !!mine && !mine.auto,
  };
}

export async function nominateAction(eventId: number, picks: AsRoster) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Sign in as a GM." };
  for (const s of ["F", "D", "G"] as const) if ((picks[s]?.length ?? 0) !== NOMINATE[s]) return { ok: false as const, error: "Pick 3 forwards, 2 defensemen and 1 goalie." };
  try { await submitNomination(eventId, teamId, picks); } catch (e) { return { ok: false as const, error: (e as Error).message }; }
  revalidatePath("/all-star");
  return { ok: true as const };
}

export async function saveLineupAction(eventId: number, div: DivKey, lineup: Lineup) {
  const [teamId, admin] = await Promise.all([getTeamSession(), isAdmin()]);
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev) return { ok: false as const, error: "Event not found." };
  const coachOf = teamsOf(ev).find((t) => t.key === div)?.coachTeamId;
  const asAdmin = admin && coachOf !== teamId;
  try { await submitLineup(eventId, teamId, div, lineup, { asAdmin }); } catch (e) { return { ok: false as const, error: (e as Error).message }; }
  revalidatePath("/all-star");
  revalidatePath("/all-star/coach");
  return { ok: true as const };
}
