"use server";

import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getTeamSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveBallot, votingState, type Ballot } from "@/lib/all-star-server";

const FAN_COOKIE = "unhl_fan";

/** GMs vote as their club (counts in the GM share); everyone else as a fan,
 *  identified by a long-lived cookie — one editable ballot each. */
export async function submitBallotAction(eventId: number, ballot: Ballot) {
  const ev = await prisma.allStarEvent.findUnique({ where: { id: eventId } });
  if (!ev) return { ok: false as const, error: "Event not found." };
  if (votingState(ev) !== "open") return { ok: false as const, error: "Voting isn't open right now." };
  const teamId = await getTeamSession();
  let voterKey: string;
  if (teamId != null) voterKey = `gm:${teamId}`;
  else {
    const jar = await cookies();
    let id = jar.get(FAN_COOKIE)?.value;
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      id = randomUUID();
      jar.set(FAN_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
    }
    voterKey = `fan:${id}`;
  }
  try {
    await saveBallot(eventId, voterKey, teamId != null, ballot);
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
  revalidatePath("/all-star");
  return { ok: true as const, asGm: teamId != null };
}

export async function myVoterKey(): Promise<string | null> {
  const teamId = await getTeamSession();
  if (teamId != null) return `gm:${teamId}`;
  const id = (await cookies()).get(FAN_COOKIE)?.value;
  return id ? `fan:${id}` : null;
}
