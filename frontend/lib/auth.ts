// Lightweight team-based auth (STHS-style per-team password). Low-stakes for a
// hockey sim: a signed cookie holds the logged-in teamId. Passwords are salted
// SHA-256 hashes. Not production-grade security — good enough to gate line edits.

import { cookies } from "next/headers";
import { createHmac, createHash, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

const COOKIE = "team_session";
const SECRET = process.env.AUTH_SECRET ?? "profinhl-dev-secret-change-me";
const SALT = process.env.AUTH_SALT ?? "profinhl-salt";

// Caddy serves BOTH unhl.eu and www.unhl.eu on the same site block with no
// canonical redirect between them (see the server's Caddyfile — DOMAIN="unhl.eu
// www.unhl.eu"), so a visitor can land on either host at any time (a shared
// link, a bookmark, a notification click). Without an explicit `domain` a
// cookie is host-only — set while on unhl.eu, it's invisible on www.unhl.eu and
// vice versa, so a GM could log in on one host and look "logged out" the
// moment any link (e.g. a message notification) takes them to the other,
// looping forever since each re-login only re-sets the cookie for whichever
// host they happened to be on. A leading dot shares it across both. Only
// applied in production — a literal `.unhl.eu` domain attribute is invalid
// (and silently rejected by the browser) on localhost during dev.
const COOKIE_DOMAIN = process.env.NODE_ENV === "production" ? ".unhl.eu" : undefined;

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
}

export async function getTeamSession(): Promise<number | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [value, sig] = token.split(".");
  if (!value || !sig || sign(value) !== sig) return null;
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
