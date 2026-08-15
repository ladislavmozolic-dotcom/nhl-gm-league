import { prisma } from "./prisma";

export type Announcement = { id: number; body: string; linkUrl: string | null; linkLabel: string | null; createdAt: Date };

/** Active commissioner announcements, newest first. */
export async function activeAnnouncements(): Promise<Announcement[]> {
  return prisma.commissionerAnnouncement.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, body: true, linkUrl: true, linkLabel: true, createdAt: true },
  });
}

/** The active announcements a given GM hasn't read yet (their unread "DMs"). */
export async function unreadForTeam(teamId: number): Promise<Announcement[]> {
  const [all, reads] = await Promise.all([
    activeAnnouncements(),
    prisma.announcementRead.findMany({ where: { teamId }, select: { announcementId: true } }),
  ]);
  const seen = new Set(reads.map((r) => r.announcementId));
  return all.filter((a) => !seen.has(a.id));
}

/** A safe href for an announcement link: internal path or http(s) URL only. */
export function safeLinkHref(url: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  if (u.startsWith("/")) return u;                       // internal path
  if (/^https?:\/\//i.test(u)) return u;                 // external URL
  return null;                                            // reject anything else (js:, etc.)
}
