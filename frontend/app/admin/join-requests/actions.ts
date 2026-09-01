"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin, getTeamSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function adminName(): Promise<string> {
  const id = await getTeamSession();
  if (!id) return "Admin";
  const t = await prisma.team.findUnique({ where: { id }, select: { gmNickname: true } });
  return t?.gmNickname || "Admin";
}

/** Approve a join request → move the applicant's credentials onto the team, reject the rest. */
export async function approveJoinRequest(formData: FormData) {
  if (!(await isAdmin())) throw new Error("Admin only.");
  const id = Number(formData.get("id"));
  const req = await prisma.joinRequest.findUnique({ where: { id } });
  if (!req || req.status !== "pending") { revalidatePath("/admin/join-requests"); return; }

  const team = await prisma.team.findUnique({ where: { id: req.teamId }, select: { passwordHash: true } });
  const who = await adminName();

  if (team?.passwordHash) {
    // team already claimed in the meantime → reject this request instead
    await prisma.joinRequest.update({ where: { id }, data: { status: "rejected", decidedBy: who, decidedAt: new Date() } });
    revalidatePath("/admin/join-requests");
    return;
  }

  await prisma.$transaction([
    prisma.team.update({
      where: { id: req.teamId },
      data: { passwordHash: req.passwordHash, gmFirstName: req.firstName, gmLastName: req.lastName, gmNickname: req.nickname, gmEmail: req.email },
    }),
    prisma.joinRequest.update({ where: { id }, data: { status: "approved", decidedBy: who, decidedAt: new Date() } }),
    // any other pending request for the same team is now moot
    prisma.joinRequest.updateMany({
      where: { teamId: req.teamId, status: "pending", id: { not: id } },
      data: { status: "rejected", decidedBy: who, decidedAt: new Date() },
    }),
  ]);
  revalidatePath("/admin/join-requests");
  revalidatePath("/", "layout");
}

/** Reject a join request. */
export async function rejectJoinRequest(formData: FormData) {
  if (!(await isAdmin())) throw new Error("Admin only.");
  const id = Number(formData.get("id"));
  const who = await adminName();
  await prisma.joinRequest.updateMany({ where: { id, status: "pending" }, data: { status: "rejected", decidedBy: who, decidedAt: new Date() } });
  revalidatePath("/admin/join-requests");
  revalidatePath("/", "layout");
}

/** Remove a registered GM — clears the login/identity fields so the team reverts to
 *  "🤖 AI GM" (unclaimed) everywhere that reads them live (League/GM Directory,
 *  the top-menu GM name, etc.) and can be claimed again via a new join request.
 *  Deliberately leaves isAdmin/gmRole untouched, matching approveJoinRequest's own
 *  behavior — those are a property of the SEAT (a team's standing league role),
 *  not the specific person, so whoever claims the team next keeps continuity with
 *  it exactly as re-approving an existing team already does. Does NOT invalidate an
 *  already-active login cookie for that team (this app's session is a signed teamId
 *  cookie, not tied to the password) — if the removed GM is still signed in on their
 *  own device, they keep working until they log out or the cookie expires (30 days).
 */
export async function removeGmAction(formData: FormData) {
  if (!(await isAdmin())) throw new Error("Admin only.");
  const teamId = Number(formData.get("teamId"));
  await prisma.team.update({
    where: { id: teamId },
    data: { passwordHash: null, gmFirstName: null, gmLastName: null, gmNickname: null, gmEmail: null, lastLoginAt: null },
  });
  revalidatePath("/admin/join-requests");
  revalidatePath("/league");
  revalidatePath("/", "layout");
}
