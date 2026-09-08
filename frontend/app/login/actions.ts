"use server";

import { prisma } from "@/lib/prisma";
import { verifyPassword, setTeamSession } from "@/lib/auth";
import { recordLogin } from "@/lib/login-log";

export type DirectLoginResult = { ok: true; redirectTo: string; rememberToken: string } | { ok: false; error: string };

/** Direct GM sign-in — no team picking. The GM types their email or nickname + password;
 *  we find their (already-claimed) club and drop them straight onto its roster.
 *
 *  Returns a result instead of calling redirect() itself — some mobile browsers
 *  (observed on iOS Safari) don't reliably commit a Set-Cookie from a Server
 *  Action's response when the framework turns redirect() into a client-side
 *  route transition instead of a full navigation: the cookie would work for
 *  the very next request or two, then vanish. The caller (LoginForm, a client
 *  component) does a real `window.location.href` on success instead, which
 *  forces a fresh top-level request and reliably commits the cookie first. */
export async function directLogin(formData: FormData): Promise<DirectLoginResult> {
  const id = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!id || !password) return { ok: false, error: "bad" };

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
  if (!match) return { ok: false, error: "bad" };

  await prisma.team.update({ where: { id: match.id }, data: { lastLoginAt: new Date() } });
  await recordLogin(match.id); // audit: IP + geolocation
  const rememberToken = await setTeamSession(match.id);
  return { ok: true, redirectTo: `/teams/${match.slug}/roster`, rememberToken };
}
