import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function GmLoginPage() {
  const [teams, session] = await Promise.all([
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: { id: true, name: true, slug: true, logoUrl: true, conference: true },
      orderBy: { name: "asc" },
    }),
    getTeamSession(),
  ]);
  const current = session ? teams.find((t) => t.id === session) : null;

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="GM Sign In" subtitle="Pick your team to manage its lines, rosters, numbers and finances." />

      {current && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm">
          {current.logoUrl && <img src={current.logoUrl} alt="" className="w-8 h-8 object-contain" />}
          <span>Signed in as <b>{current.name}</b> GM.</span>
          <Link href={`/teams/${current.slug}`} className="ml-auto text-green-300 hover:underline">Manage team →</Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {teams.map((t) => (
          <Link key={t.id} href={`/teams/${t.slug}/login`}
            className="flex items-center gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 px-4 py-3 hover:border-slate-600 transition-colors">
            {t.logoUrl && <img src={t.logoUrl} alt="" className="w-8 h-8 object-contain" />}
            <span className="font-medium text-sm">{t.name}</span>
          </Link>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Admin (league operations) is separate — see <Link href="/admin/season" className="text-blue-400 hover:underline">Admin</Link>.
      </p>
    </div>
  );
}
