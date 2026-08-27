// Lightweight team-based auth (STHS-style per-team password). Low-stakes for a
// hockey sim: a signed cookie holds the logged-in teamId. Passwords are salted
// SHA-256 hashes. Not production-grade security — good enough to gate line edits.

import { cookies } from "next/headers";
import { createHmac, createHash, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

const COOKIE = "team_session";
const SECRET = process.env.AUTH_SECRET ?? "profinhl-dev-secret-change-me";
const SALT = process.env.AUTH_SALT ?? "profinhl-salt";

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
  (await cookies()).delete(COOKIE);
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
