import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    where: { parentTeamId: null },
    include: { affiliateTeams: true },
    orderBy: { name: "asc" },
  });

  // DB má "Eastern Conference" a "Western Conference" — nie "Eastern" / "Western"
  const east = teams.filter((t) => t.conference?.trim().toLowerCase() === "eastern conference");
  const west = teams.filter((t) => t.conference?.trim().toLowerCase() === "western conference");
  const other = teams.filter((t) => {
    const c = t.conference?.trim().toLowerCase();
    return c !== "eastern conference" && c !== "western conference";
  });

  return (
    <div className="space-y-10 py-2">
      <PageHeader
        title="NHL Teams"
        subtitle={`${teams.length} total • ${east.length} Eastern • ${west.length} Western${other.length > 0 ? ` • ${other.length} Unassigned` : ""}`}
      />

      {/* EASTERN */}
      {east.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1.5 h-8 bg-blue-500 rounded-full" />
            <h2 className="text-xl font-bold">Eastern Conference</h2>
            <span className="text-xs bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-full text-slate-400">{east.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {east.map((team) => <TeamCard key={team.id} team={team} />)}
          </div>
        </section>
      )}

      {/* WESTERN */}
      {west.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1.5 h-8 bg-red-500 rounded-full" />
            <h2 className="text-xl font-bold">Western Conference</h2>
            <span className="text-xs bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-full text-slate-400">{west.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {west.map((team) => <TeamCard key={team.id} team={team} />)}
          </div>
        </section>
      )}

      {/* UNASSIGNED */}
      {other.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1.5 h-8 bg-slate-500 rounded-full" />
            <h2 className="text-xl font-bold">Unassigned</h2>
            <span className="text-xs bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-full text-slate-400">{other.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {other.map((team) => <TeamCard key={team.id} team={team} />)}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================================
   TEAM CARD
   ============================================ */
function TeamCard({ team }: { team: any }) {
  return (
    <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg shadow-black/20 overflow-hidden hover:border-slate-600 transition-all group">
      <div className="h-1 bg-gradient-to-r from-blue-600 to-blue-400" />
      <div className="p-5">
        <div className="flex items-center gap-4 mb-5">
          {team.logoUrl ? (
            <img src={team.logoUrl} alt={team.name} className="w-14 h-14 object-contain flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
          ) : (
            <div className="w-14 h-14 bg-slate-800 rounded-lg flex items-center justify-center text-xl font-bold text-slate-500 flex-shrink-0">
              {team.code || team.name[0]}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-bold truncate group-hover:text-blue-400 transition-colors">{team.name}</h3>
            <p className="text-xs text-slate-500">{team.code} • {team.division || "Division TBD"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <InfoBox label="General Manager" value={team.gm} />
          <InfoBox label="Head Coach" value={team.coach || "TBD"} />
          <InfoBox label="Arena" value={team.arena} />
          <InfoBox label="Capacity" value={team.capacity ? team.capacity.toLocaleString() : "N/A"} />
        </div>

        <Link href={`/teams/${team.slug}`} className="mt-5 inline-flex items-center text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
          View Roster
          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {team.affiliateTeams?.length > 0 && (
        <details className="border-t border-slate-800 group/aff">
          <summary className="px-5 py-3 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer select-none transition-colors flex items-center justify-between list-none">
            <span className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-slate-800 px-2 py-0.5 rounded text-slate-300 uppercase">AHL</span>
              {team.affiliateTeams.length} affiliate{team.affiliateTeams.length > 1 ? "s" : ""}
            </span>
            <svg className="w-4 h-4 transition-transform group-open/aff:rotate-180 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-5 pb-4 space-y-2">
            {team.affiliateTeams.map((aff: any) => (
              <Link key={aff.id} href={`/teams/${aff.slug}`} className="flex items-center gap-3 p-2.5 bg-slate-950/50 rounded-lg hover:bg-slate-800/50 transition-colors group/a">
                {aff.logoUrl ? (
                  <img src={aff.logoUrl} alt={aff.name} className="w-9 h-9 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 bg-slate-800 rounded-md flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">{aff.code || aff.name[0]}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover/a:text-blue-400 transition-colors">{aff.name}</p>
                  <p className="text-[11px] text-slate-500">GM: {aff.gm}</p>
                </div>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-950/50 rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold truncate">{value}</p>
    </div>
  );
}