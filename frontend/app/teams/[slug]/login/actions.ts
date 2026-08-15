"use server";

import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword, setTeamSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const password = String(formData.get("password") ?? "");
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, passwordHash: true } });
  if (!team) redirect("/teams");

  if (!team.passwordHash) {
    // first sign-in creates the GM profile + sets the team password
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const nickname = String(formData.get("nickname") ?? "").trim();
    const gmEmail = String(formData.get("email") ?? "").trim();
    if (password.length < 3) redirect(`/teams/${slug}/login?error=short`);
    if (!firstName || !lastName || !nickname || !gmEmail) redirect(`/teams/${slug}/login?error=profile`);
    await prisma.team.update({
      where: { id: team.id },
      data: { passwordHash: hashPassword(password), gmFirstName: firstName, gmLastName: lastName, gmNickname: nickname, gmEmail },
    });
  } else if (!verifyPassword(password, team.passwordHash)) {
    redirect(`/teams/${slug}/login?error=wrong`);
  }

  await prisma.team.update({ where: { id: team.id }, data: { lastLoginAt: new Date() } });
  await setTeamSession(team.id);
  redirect(`/teams/${slug}/lines`);
}
