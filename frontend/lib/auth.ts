// Team-based authentication. Sessions are expiring, versioned, and checked
// against the current credentials on every request. Legacy passwords remain
// compatible until the separate password-hashing migration.
import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { authConfig } from "./auth-config";
import { encodeSession, decodeSession, credentialTag } from "./session-token";

const COOKIE = "team_session";
// Keep host-only cookies; do not reintroduce a second domain-scoped cookie.
const COOKIE_DOMAIN = undefined;

export function hashPassword(password: string): string {
  return createHash("sha256").update(authConfig().salt + password).digest("hex");
}

export function verifyPassword(password: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashPassword(password));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function validatedSession(token: string | undefined | null) {
  const { secret } = authConfig();
  const claims = decodeSession(token, secret);
  if (!claims) return null;
  const team = await prisma.team.findUnique({
    where: { id: claims.teamId }, select: { passwordHash: true, sessionVersion: true },
  });
  if (!team?.passwordHash || team.sessionVersion !== claims.version) return null;
  const expected = Buffer.from(credentialTag(team.passwordHash, secret), "hex");
  if (!timingSafeEqual(expected, Buffer.from(claims.credential, "hex"))) return null;
  return claims;
}

async function writeSessionCookie(token: string, expiresAt: number) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/",
    expires: new Date(expiresAt * 1000),
    secure: process.env.NODE_ENV === "production", domain: COOKIE_DOMAIN,
  });
}

/** Issue only after verifying a password; reject credentials changed mid-login. */
export async function setTeamSession(teamId: number, verifiedPasswordHash: string): Promise<string> {
  const { secret } = authConfig();
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { passwordHash: true, sessionVersion: true } });
  if (!team?.passwordHash || team.passwordHash !== verifiedPasswordHash) throw new Error("Credentials changed. Sign in again.");
  const token = encodeSession(teamId, team.sessionVersion, team.passwordHash, secret);
  const claims = decodeSession(token, secret)!;
  await writeSessionCookie(token, claims.expiresAt);
  return token;
}

/** Restore the SAME token and expiry, never extend a remember-token's lifetime. */
export async function resumeTeamSession(token: string | null): Promise<boolean> {
  const claims = await validatedSession(token);
  if (!claims || !token) return false;
  await writeSessionCookie(token, claims.expiresAt);
  return true;
}

// React cache is scoped to a request; revocations take effect on the next request.
export const getTeamSession = cache(async (): Promise<number | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  return (await validatedSession(token))?.teamId ?? null;
});

export async function clearTeamSession(): Promise<void> {
  // must match the domain/path it was set with, or the browser silently keeps
  // the real cookie and this just no-ops against a cookie that never existed.
  (await cookies()).delete({ name: COOKIE, path: "/", domain: COOKIE_DOMAIN });
}

/** True for any signed-in GM (any team), false for an anonymous visitor. Used to
 *  gate player attribute ratings (CK/FG/DI/SK/...) — visible to any logged-in GM,
 *  hidden from the public. */
export async function isLoggedIn(): Promise<boolean> {
  return (await getTeamSession()) != null;
}

/** True if the signed-in GM's team carries the league-admin flag. */
export async function isAdmin(): Promise<boolean> {
  const id = await getTeamSession();
  if (id == null) return false;
  const t = await prisma.team.findUnique({ where: { id }, select: { isAdmin: true } });
  return !!t?.isAdmin;
}

/** Comish-tier = commissioner (isAdmin) or a co-commissioner / league agent.
 *  These roles get a one-day head-start each free-agent round. */
export async function isComishTier(): Promise<boolean> {
  const id = await getTeamSession();
  if (id == null) return false;
  const t = await prisma.team.findUnique({ where: { id }, select: { isAdmin: true, gmRole: true } });
  return !!t?.isAdmin || ["comish", "co_comish", "agent"].includes(t?.gmRole ?? "gm");
}

/** The commissioner (isAdmin) or the co-commissioner only — excludes agent/trade_comish.
 *  Gates admin-panel roster overrides (LTIR, Send to Prospects) that move real cap
 *  space, so it deliberately stays narrower than isCommission()/isComishTier(). */
export async function isComishOrCoComish(): Promise<boolean> {
  const id = await getTeamSession();
  if (id == null) return false;
  const t = await prisma.team.findUnique({ where: { id }, select: { isAdmin: true, gmRole: true } });
  return !!t?.isAdmin || t?.gmRole === "co_comish";
}

/** Commission = the commissioner (isAdmin) or a (co-)commissioner. These may review and
 *  Accept / Decline / Modify a rookie GM's trades. Excludes plain "agent". */
export async function isCommission(): Promise<boolean> {
  const id = await getTeamSession();
  if (id == null) return false;
  const t = await prisma.team.findUnique({ where: { id }, select: { isAdmin: true, gmRole: true } });
  return !!t?.isAdmin || ["comish", "co_comish", "trade_comish"].includes(t?.gmRole ?? "gm");
}

/** May the current session manage `teamId`? True for that team's own GM, for any
 *  admin GM (who can edit every team from the Admin panel), or for the GM of the
 *  parent NHL club when `teamId` is its AHL affiliate — the farm is managed with
 *  the main club's login, not a separate one. */
export async function canManageTeam(teamId: number): Promise<boolean> {
  const id = await getTeamSession();
  if (id == null) return false;
  const [me, target] = await Promise.all([
    prisma.team.findUnique({ where: { id }, select: { isAdmin: true, passwordHash: true } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { parentTeamId: true } }),
  ]);
  // a session whose team has been vacated (its GM was reassigned elsewhere) is
  // stale — treat it as logged out so the manager re-signs in at their new club.
  if (!me?.passwordHash) return false;
  if (id === teamId) return true;
  if (me.isAdmin) return true;
  return target?.parentTeamId === id; // I'm the parent club of this affiliate
}
