"use server";

import { prisma } from "@/lib/prisma";
import { verifyPassword, setTeamSession } from "@/lib/auth";
import { recordLogin } from "@/lib/login-log";
import { redirect } from "next/navigation";

/** Direct GM sign-in — no team picking. The GM types their email or nickname + password;
 *  we find their (already-claimed) club and drop them straight onto its roster. */
export async function directLogin(formData: FormData) {
  const id = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!id || !password) redirect("/login?error=bad");

  // a GM is identified by their email OR their nickname (case-insensitive); only
  // claimed teams (passwordHash set) can be signed into this way.
  const candidates = await prisma.team.findMany({
    where: {
      passwordHash: { not: null },
      OR: [{ gmEmail: { equals: id, mode: "insensitive" } }, { gmNickname: { equals: id, mode: "insensitive" } }],
    },
    select: { id: true, slug: true, passwordHash: true },
  });

  const match = candidates.find((t) => t.passwordHash && verifyPassword(password, t.passwordHash));
  if (!match) redirect("/login?error=bad");

  await prisma.team.update({ where: { id: match.id }, data: { lastLoginAt: new Date() } });
  await recordLogin(match.id); // audit: IP + geolocation
  await setTeamSession(match.id);
  redirect(`/teams/${match.slug}/roster`);
}
