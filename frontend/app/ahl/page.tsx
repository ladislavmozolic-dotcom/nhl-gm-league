import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { PageHeader } from "@/components/ui";

export default async function AhlTeamsPage() {
  const teams = await prisma.team.findMany({
    where: {
      league: "AHL",
    },
    orderBy: {
      name: "asc",
    },
    include: {
      parentTeam: true,
    },
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="AHL Teams" subtitle={`${teams.length} affiliate clubs across the league.`} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div
            key={team.id}
            className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg shadow-black/20 overflow-hidden hover:border-slate-600 transition-all group"
          >
            <div className="h-1 bg-gradient-to-r from-emerald-600 to-emerald-400" />
            <div className="p-5">
              <div className="flex items-center gap-4 mb-4">
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt={team.name} className="w-14 h-14 object-contain flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
                ) : (
                  <div className="w-14 h-14 bg-slate-800 rounded-lg flex items-center justify-center text-xl font-bold text-slate-500 flex-shrink-0">
                    {team.code || team.name[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-lg font-bold truncate group-hover:text-emerald-300 transition-colors">{team.name}</h3>
                  <p className="text-xs text-slate-500">{team.code || "AHL"}</p>
                </div>
              </div>

              <div className="bg-slate-950/50 rounded-lg p-2.5 mb-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">NHL Affiliate</p>
                <p className="text-sm font-semibold truncate">{team.parentTeam?.name ?? "None"}</p>
              </div>

              <Link href={`/ahl/${team.slug}`} className="inline-flex items-center text-sm font-medium text-emerald-300 hover:text-emerald-200 transition-colors">
                View Roster
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
