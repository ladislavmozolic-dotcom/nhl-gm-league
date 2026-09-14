import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { PageHeader, Card, BackPill } from "@/components/ui";

export const dynamic = "force-dynamic";

type TeamRow = { id: number; name: string; slug: string; logoUrl: string | null; lines: { updatedAt: Date } | null };

function TeamGroup({ label, list }: { label: string; list: TeamRow[] }) {
  return (
    <Card bodyClassName="p-0">
      <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-800/30">{label}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <Link key={t.id} href={`/admin/chemistry/${t.slug}`}
            className="flex items-center gap-2.5 px-4 py-3 border-b border-r border-slate-800/50 hover:bg-slate-800/40 transition-colors">
            {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain" />}
            <span className="text-sm font-medium flex-1 truncate">{t.name}</span>
            <span className="text-[11px] text-slate-500">{t.lines ? "lines set" : "no lines"}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default async function AdminChemistryPage() {
  if (!(await isAdmin())) redirect("/");
  const teams = await prisma.team.findMany({
    where: { isAffiliate: false },
    select: { id: true, name: true, slug: true, logoUrl: true, league: true, lines: { select: { updatedAt: true } } },
    orderBy: [{ league: "asc" }, { name: "asc" }],
  });
  const nhl = teams.filter((t) => t.league === "NHL");
  const ahl = teams.filter((t) => t.league === "AHL");

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Chemistry Editor" subtitle="Directly set a line/pair/special-team unit's chemistry — takes effect in the very next sim." right={<BackPill href="/admin">Admin</BackPill>} />
      <TeamGroup label="NHL" list={nhl} />
      <TeamGroup label="Farm (AHL)" list={ahl} />
    </div>
  );
}
