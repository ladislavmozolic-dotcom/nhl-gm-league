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
