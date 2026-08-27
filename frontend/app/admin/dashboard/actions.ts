"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const ROLES = ["gm", "agent", "trade_comish", "co_comish", "comish"];

/** Commissioner assigns a league role to a club's GM seat. Comish also flips the
 *  isAdmin flag so co-commissioners get full commissioner powers. */
export async function setGmRoleAction(teamId: number, role: string) {
  if (!(await isAdmin())) return { ok: false as const, error: "Commissioner only." };
  if (!ROLES.includes(role)) return { ok: false as const, error: "Unknown role." };
  await prisma.team.update({
    where: { id: teamId },
    data: { gmRole: role, isAdmin: role === "comish" || role === "co_comish" },
  });
  revalidatePath("/admin/dashboard");
  return { ok: true as const };
}

/** Commissioner flags/unflags a club's GM as a rookie (R) — his trades then need
 *  commission approval before they execute. */
export async function setRookieGmAction(teamId: number, rookie: boolean) {
  if (!(await isAdmin())) return { ok: false as const, error: "Commissioner only." };
  await prisma.team.update({ where: { id: teamId }, data: { rookieGm: rookie } });
  revalidatePath("/admin/dashboard");
  return { ok: true as const };
}

/** Commissioner sets a GM-less club's AI mode: "base" (lineups/cap only) or
 *  "advanced" (also negotiates trades with human GMs). */
export async function setAiModeAction(teamId: number, mode: string) {
  if (!(await isAdmin())) return { ok: false as const, error: "Commissioner only." };
  if (mode !== "base" && mode !== "advanced") return { ok: false as const, error: "Unknown mode." };
  await prisma.team.update({ where: { id: teamId }, data: { aiMode: mode } });
  revalidatePath("/admin/dashboard");
  return { ok: true as const };
}

// the fields that together make up a GM's login/identity — everything that moves
// when a manager takes over a different franchise. The roster stays put; only the
// person controlling the club changes.
const GM_FIELDS = [
  "passwordHash", "isAdmin", "gmRole", "gmEmail", "gmFirstName", "gmLastName", "gmNickname", "lastLoginAt",
] as const;
type GmSeat = Record<(typeof GM_FIELDS)[number], unknown>;
const pickGm = (t: GmSeat): GmSeat => Object.fromEntries(GM_FIELDS.map((k) => [k, t[k]])) as GmSeat;
const blankGm: GmSeat = { passwordHash: null, isAdmin: false, gmRole: "gm", gmEmail: null, gmFirstName: null, gmLastName: null, gmNickname: null, lastLoginAt: null };

/** Move an active GM (login + identity) from one club to another. If the destination
 *  already has a GM the two seats are SWAPPED; otherwise the source is left vacant. */
export async function reassignGmTeamAction(fromTeamId: number, toTeamId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Commissioner only." };
  if (fromTeamId === toTeamId) return { ok: false as const, error: "Pick a different destination team." };
  const teams = await prisma.team.findMany({
    where: { id: { in: [fromTeamId, toTeamId] } },
    select: { id: true, name: true, passwordHash: true, isAdmin: true, gmRole: true, gmEmail: true, gmFirstName: true, gmLastName: true, gmNickname: true, lastLoginAt: true },
  });
  const from = teams.find((t) => t.id === fromTeamId);
  const to = teams.find((t) => t.id === toTeamId);
  if (!from || !to) return { ok: false as const, error: "Team not found." };
  if (!from.passwordHash) return { ok: false as const, error: `${from.name} has no active GM to move.` };

  const swapped = !!to.passwordHash;
  await prisma.$transaction([
    prisma.team.update({ where: { id: toTeamId }, data: pickGm(from) as never }),
    prisma.team.update({ where: { id: fromTeamId }, data: (swapped ? pickGm(to) : blankGm) as never }),
  ]);
  revalidatePath("/admin/dashboard");
  return { ok: true as const, swapped, from: from.name, to: to.name };
}
