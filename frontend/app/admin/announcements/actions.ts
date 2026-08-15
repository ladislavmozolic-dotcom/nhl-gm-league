"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin, getTeamSession } from "@/lib/auth";
import { safeLinkHref } from "@/lib/announcements";
import { revalidatePath } from "next/cache";

/** Admin posts a league-wide commissioner message (optionally with a link). */
export async function postAnnouncementAction(input: { body: string; linkUrl?: string; linkLabel?: string }) {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  const body = input.body?.trim().slice(0, 2000);
  if (!body) return { ok: false, error: "Message can't be empty." };
  const linkUrl = input.linkUrl?.trim() ? safeLinkHref(input.linkUrl) : null;
  if (input.linkUrl?.trim() && !linkUrl) return { ok: false, error: "Link must be an internal path (/…) or http(s) URL." };
  const linkLabel = input.linkLabel?.trim().slice(0, 80) || null;
  await prisma.commissionerAnnouncement.create({ data: { body, linkUrl, linkLabel } });
  revalidatePath("/admin/announcements");
  revalidatePath("/");
  return { ok: true };
}

/** Admin retires an announcement (hidden everywhere, kept for the record). */
export async function setAnnouncementActiveAction(id: number, active: boolean) {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  await prisma.commissionerAnnouncement.update({ where: { id }, data: { active } });
  revalidatePath("/admin/announcements");
  revalidatePath("/");
  return { ok: true };
}

/** Admin permanently deletes an announcement. */
export async function deleteAnnouncementAction(id: number) {
  if (!(await isAdmin())) return { ok: false, error: "Admin only." };
  await prisma.commissionerAnnouncement.delete({ where: { id } });
  revalidatePath("/admin/announcements");
  revalidatePath("/");
  return { ok: true };
}

/** A signed-in GM marks a commissioner message read (clears it from their inbox). */
export async function markAnnouncementReadAction(id: number) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false };
  await prisma.announcementRead.upsert({
    where: { announcementId_teamId: { announcementId: id, teamId } },
    update: {},
    create: { announcementId: id, teamId },
  });
  revalidatePath("/");
  return { ok: true };
}
