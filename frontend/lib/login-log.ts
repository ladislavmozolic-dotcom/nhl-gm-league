import { headers } from "next/headers";
import { prisma } from "./prisma";

const isPrivate = (ip: string) => /^(10\.|127\.|::1|localhost|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

/** Log one access event (a GM sign-in or a visit) with IP + best-effort geolocation.
 *  Never throws — auditing must not block anything. */
export async function logAccess(opts: { type: "gm" | "visit"; teamId?: number | null; path?: string | null }): Promise<void> {
  try {
    const h = await headers();
    const fwd = (h.get("x-forwarded-for") || h.get("x-real-ip") || "").split(",")[0].trim();
    const ip = fwd || null;
    const userAgent = (h.get("user-agent") || "").slice(0, 300) || null;
    let geo: { country?: string; regionName?: string; city?: string; isp?: string } = {};
    if (ip && !isPrivate(ip)) {
      geo = await fetch(`http://ip-api.com/json/${ip}?fields=country,regionName,city,isp`, { signal: AbortSignal.timeout(2500) })
        .then((r) => r.json()).catch(() => ({}));
    }
    await prisma.loginLog.create({
      data: { type: opts.type, teamId: opts.teamId ?? null, path: opts.path ?? null, ip, userAgent, country: geo.country ?? null, region: geo.regionName ?? null, city: geo.city ?? null, isp: geo.isp ?? null },
    });
  } catch { /* auditing must never block */ }
}

/** Record a successful GM sign-in. */
export const recordLogin = (teamId: number) => logAccess({ type: "gm", teamId });
