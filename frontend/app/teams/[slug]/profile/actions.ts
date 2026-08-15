"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession, verifyPassword, hashPassword } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, passwordHash: true } });
  if (!team) redirect("/teams");

  // only the signed-in GM of this team may edit
  const session = await getTeamSession();
  if (session !== team.id) redirect(`/teams/${slug}/login`);

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const nickname = String(formData.get("nickname") ?? "").trim();
  const gmEmail = String(formData.get("email") ?? "").trim();
  if (!firstName || !lastName || !nickname || !gmEmail) redirect(`/teams/${slug}/profile?error=fields`);

  const currentPw = String(formData.get("currentPassword") ?? "");
  const newPw = String(formData.get("newPassword") ?? "");

  const data: Record<string, unknown> = { gmFirstName: firstName, gmLastName: lastName, gmNickname: nickname, gmEmail };

  if (newPw) {
    // changing the password requires the current one
    if (!verifyPassword(currentPw, team.passwordHash)) redirect(`/teams/${slug}/profile?error=pw`);
    if (newPw.length < 3) redirect(`/teams/${slug}/profile?error=short`);
    data.passwordHash = hashPassword(newPw);
  }

  await prisma.team.update({ where: { id: team.id }, data });
  revalidatePath("/", "layout");
  redirect(`/teams/${slug}/profile?ok=1`);
}
