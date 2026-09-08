// Lightweight team-based auth (STHS-style per-team password). Low-stakes for a
// hockey sim: a signed cookie holds the logged-in teamId. Passwords are salted
// SHA-256 hashes. Not production-grade security — good enough to gate line edits.

import { cache } from "react";
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
// carrying that old `.unhl.eu`-scoped cookie in their browser alongside the
// new host-only one — a real lead worth investigating further, but a same-name
// cleanup delete turned out to be unsafe to fire from getTeamSession()/
// setTeamSession(): Next's cookies() response jar keys its internal map by
// cookie NAME ONLY (not name+domain), so a delete() for "team_session" can
// clobber an in-flight real login cookie write for "team_session" elsewhere in
// the same response/action, regardless of call order — this shipped for a few
// minutes and broke login outright. Don't reintroduce a same-name delete on
// this hot path without a way to isolate it from the real cookie write (e.g.
// a dedicated one-off Route Handler hit outside the login flow).

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

/** Builds the same signed "teamId.signature" value the session cookie carries.
 *  Exported so the login action can also hand it to the client for the
 *  localStorage remember-token fallback (see SessionResume.tsx) — it's the
 *  exact same credential, just given a second delivery channel that isn't
 *  subject to whatever iOS Safari does to drop the httpOnly cookie mid-session. */
export function buildSessionToken(teamId: number): string {
  const value = String(teamId);
  return `${value}.${sign(value)}`;
}

/** The inverse of buildSessionToken — verifies a token's signature and returns
 *  the teamId it encodes, or null if malformed/tampered. Used both by
 *  getTeamSession() (reading the cookie) and the /api/auth/resume route
 *  (reading the localStorage remember-token). */
export function verifySessionToken(token: string | undefined | null): number | null {
  if (!token) return null;
  const [value, sig] = token.split(".");
  if (!value || !sig || sign(value) !== sig) return null;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

export async function setTeamSession(teamId: number): Promise<string> {
  const token = buildSessionToken(teamId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production", domain: COOKIE_DOMAIN,
  });
  // TEMP DEBUG — remove once the mobile logout-loop report is confirmed fixed.
  try {
    const h = await headers();
    console.log(`[auth-debug] setTeamSession team=${teamId} host=${h.get("host")} ua=${(h.get("user-agent") ?? "").slice(0, 80)}`);
  } catch { /* ignore */ }
  return token;
}

// Memoized per request (React's cache()) — isAdmin()/isComishTier()/canManageTeam()/etc.
// all call this, so a page that uses a few of them would otherwise re-read + re-verify the
// same cookie several times over.
export const getTeamSession = cache(async (): Promise<number | null> => {
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
