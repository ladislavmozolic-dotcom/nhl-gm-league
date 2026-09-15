import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export type SessionClaims = { teamId: number; version: number; expiresAt: number; credential: string };
const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("hex");
export const credentialTag = (passwordHash: string, secret: string) => sign(`credential:${passwordHash}`, secret);

export function encodeSession(teamId: number, version: number, passwordHash: string, secret: string, now = Date.now()): string {
  const claims: SessionClaims = { teamId, version, expiresAt: Math.floor(now / 1000) + SESSION_TTL_SECONDS, credential: credentialTag(passwordHash, secret) };
  const body = `v1.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`;
  return `${body}.${sign(body, secret)}`;
}

export function decodeSession(token: string | null | undefined, secret: string, now = Date.now()): SessionClaims | null {
  if (!token || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return null;
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret), "hex");
  if (!timingSafeEqual(expected, Buffer.from(parts[2], "hex"))) return null;
  try {
    const c = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const seconds = Math.floor(now / 1000);
    if (!c || !Number.isSafeInteger(c.teamId) || c.teamId <= 0 || !Number.isSafeInteger(c.version) || c.version < 0 ||
      !Number.isSafeInteger(c.expiresAt) || c.expiresAt <= seconds || c.expiresAt > seconds + SESSION_TTL_SECONDS ||
      typeof c.credential !== "string" || !/^[a-f0-9]{64}$/.test(c.credential)) return null;
    return c as SessionClaims;
  } catch { return null; }
}
