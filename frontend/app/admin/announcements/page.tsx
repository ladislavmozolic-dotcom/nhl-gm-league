import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import AnnouncementManager, { type AdminAnnouncement } from "@/components/AnnouncementManager";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  if (!(await isAdmin())) redirect("/");
  const rows = await prisma.commissionerAnnouncement.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { reads: true } } },
  });
  const fmt = (d: Date) => `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  const items: AdminAnnouncement[] = rows.map((a) => ({
    id: a.id, body: a.body, linkUrl: a.linkUrl, linkLabel: a.linkLabel, active: a.active,
    date: fmt(a.createdAt), reads: a._count.reads,
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Commissioner Announcements" subtitle="Post league-wide messages — delivered to every GM's inbox and shown on the home page." />
      <AnnouncementManager items={items} />
    </div>
  );
}
