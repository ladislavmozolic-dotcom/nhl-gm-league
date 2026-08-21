"use server";

import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword, setTeamSession } from "@/lib/auth";
import { recordLogin } from "@/lib/login-log";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const password = String(formData.get("password") ?? "");
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, passwordHash: true } });
  if (!team) redirect("/teams");

  if (!team.passwordHash) {
    // Team is unclaimed → this is a JOIN REQUEST, not an instant claim. The applicant's
    // profile + password are stored on a pending JoinRequest; a league admin approves it
    // (credentials then move onto the Team) before they can sign in.
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const nickname = String(formData.get("nickname") ?? "").trim();
    const gmEmail = String(formData.get("email") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    if (password.length < 3) redirect(`/teams/${slug}/login?error=short`);
    if (!firstName || !lastName || !nickname || !gmEmail) redirect(`/teams/${slug}/login?error=profile`);

    // one pending request per team at a time (first come, first served)
    const pending = await prisma.joinRequest.findFirst({ where: { teamId: team.id, status: "pending" } });
    if (pending) redirect(`/teams/${slug}/login?error=pending`);

    await prisma.joinRequest.create({
      data: { teamId: team.id, firstName, lastName, nickname, email: gmEmail, note: note || null, passwordHash: hashPassword(password) },
    });
    redirect(`/teams/${slug}/login?submitted=1`);
  }

  // Team is claimed → normal sign-in.
  if (!verifyPassword(password, team.passwordHash)) {
    redirect(`/teams/${slug}/login?error=wrong`);
  }
  await prisma.team.update({ where: { id: team.id }, data: { lastLoginAt: new Date() } });
  await recordLogin(team.id); // audit: IP + geolocation
  await setTeamSession(team.id);
  redirect(`/teams/${slug}/lines`);
}
