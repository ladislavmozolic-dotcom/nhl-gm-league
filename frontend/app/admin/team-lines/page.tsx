import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminTeamLinesPage() {
  const admin = await isAdmin();
  const teams = await prisma.team.findMany({
    where: { isAffiliate: false },
    select: { id: true, name: true, slug: true, logoUrl: true, league: true, lines: { select: { updatedAt: true } } },
    orderBy: [{ league: "asc" }, { name: "asc" }],
  });
  const nhl = teams.filter((t) => t.league === "NHL");
  const ahl = teams.filter((t) => t.league === "AHL");

  const Group = ({ label, list }: { label: string; list: typeof teams }) => (
    <Card bodyClassName="p-0">
      <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-800/30">{label}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <Link key={t.id} href={`/teams/${t.slug}/lines`}
            className="flex items-center gap-2.5 px-4 py-3 border-b border-r border-slate-800/50 hover:bg-slate-800/40 transition-colors">
            {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain" />}
            <span className="text-sm font-medium flex-1 truncate">{t.name}</span>
            <span className="text-[11px] text-slate-500">{t.lines ? "lines set" : "auto"}</span>
          </Link>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Team Lines & Tactics" subtitle="Open any club's line editor to set players, PHY/DF/OF tactics and ice-time." />
      {!admin && (
        <div className="text-sm text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-lg px-4 py-3">
          You are not signed in as an <b>admin</b> GM. Sign in with an admin account (<Link href="/login" className="text-blue-400 hover:underline">GM Sign In</Link>) to edit every team — otherwise each club opens its own login.
        </div>
      )}
      <Group label="NHL" list={nhl} />
      <Group label="Farm (AHL)" list={ahl} />
    </div>
  );
}
