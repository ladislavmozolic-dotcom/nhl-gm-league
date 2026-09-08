// Lightweight team-based auth (STHS-style per-team password). Low-stakes for a
// hockey sim: a signed cookie holds the logged-in teamId. Passwords are salted
// SHA-256 hashes. Not production-grade security — good enough to gate line edits.

import { cookies, headers } from "next/headers";
import { createHmac, createHash, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

const COOKIE = "team_session";
const SECRET = process.env.AUTH_SECRET ?? "profinhl-dev-secret-change-me";
const SALT = process.env.AUTH_SALT ?? "profinhl-salt";

// www.unhl.eu now 301-redirects to the bare apex at the Caddy level (see the
// server's Caddyfile), so real traffic only ever lands on unhl.eu itself —
// the cookie no longer needs to span two hosts. A plain host-only cookie (no
// `domain` attribute) is the most standard, widely-compatible shape; a
// leading-dot domain-scoped cookie was tried first (when both hosts were
// served identically) but iOS Safari kept losing the session regardless, so
// removing this extra variable is worth doing even without a confirmed
// mechanism — it can only make the cookie's handling more conventional.
const COOKIE_DOMAIN = undefined;

// From 2026-09-06 19:44 to 2026-09-08 09:05 the cookie above was set with
// `domain: ".unhl.eu"` (commit 515fc10) before being reverted to host-only
// (commit 2a32598). Anyone who logged in during that ~37h window is still
// carrying that old `.unhl.eu`-scoped cookie in their browser — same name,
// still a validly-signed token (the secret didn't change), so it doesn't fail
// verification, it just now coexists with the new host-only cookie. Two
// same-named cookies for the same effective host is exactly the kind of thing
// WebKit/iOS Safari handles inconsistently (this is the leading suspect for
// the mobile logout-loop reports). Proactively expire the legacy one on every
// opportunity we get write access to cookies, so it clears out of affected
// browsers without needing a fresh login.
async function clearLegacyDomainCookie(): Promise<void> {
  try {
    (await cookies()).delete({ name: COOKIE, path: "/", domain: ".unhl.eu" });
  } catch {
    // not in a Server Action / Route Handler (e.g. called during a Server
    // Component render) — cookies are read-only here, nothing to clean up yet.
  }
}

export function hashPassword(password: string): string {
  return createHash("sha256").update(SALT + password).digest("hex");
}

export function verifyPassword(password: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashPassword(password));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export async function setTeamSession(teamId: number): Promise<void> {
  const value = String(teamId);
  const token = `${value}.${sign(value)}`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production", domain: COOKIE_DOMAIN,
  });
  await clearLegacyDomainCookie();
  // TEMP DEBUG — remove once the mobile logout-loop report is confirmed fixed.
  try {
    const h = await headers();
    console.log(`[auth-debug] setTeamSession team=${teamId} host=${h.get("host")} ua=${(h.get("user-agent") ?? "").slice(0, 80)}`);
  } catch { /* ignore */ }
}

export async function getTeamSession(): Promise<number | null> {
  await clearLegacyDomainCookie();
  const token = (await cookies()).get(COOKIE)?.value;
  // TEMP DEBUG — remove once the mobile logout-loop report is confirmed fixed.
  try {
    const h = await headers();
    const rawCookieHeader = h.get("cookie") ?? "";
    const dupeCount = rawCookieHeader.split(";").filter((c) => c.trim().startsWith(`${COOKIE}=`)).length;
    console.log(`[auth-debug] getTeamSession host=${h.get("host")} referer=${h.get("referer") ?? "?"} hasCookie=${!!token} cookieLen=${token?.length ?? 0} rawCookieMatches=${dupeCount} ua=${(h.get("user-agent") ?? "").slice(0, 80)}`);
  } catch { /* ignore */ }
  if (!token) return null;
  const [value, sig] = token.split(".");
  if (!value || !sig || sign(value) !== sig) {
    console.log(`[auth-debug] getTeamSession INVALID token (bad format or signature mismatch)`);
    return null;
  }
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

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
