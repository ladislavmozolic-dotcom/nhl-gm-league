import Link from "next/link";
import BackLink from "@/components/BackLink";
import { prisma } from "../../../lib/prisma";
import { isLoggedIn } from "@/lib/auth";
import { livePlayerOverall } from "@/lib/player-overall";
import { groupRoster, RosterSection } from "@/components/TeamRosterTable";
import { PageHeader, Card, StatTile } from "@/components/ui";

export default async function AhlTeamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const team = await prisma.team.findUnique({
    where: {
      slug,
    },
    include: {
      parentTeam: true,
      // rosterType-filtered — a player parked as PROSPECT/UFA/RETIRED/RELEASED keeps
      // this teamId (schema requires one) but must never show as an active AHL player.
      players: {
        where: { rosterType: "AHL" },
        orderBy: { overall: "desc" },
        include: { goalieRating: true },
      },
    },
  });

  if (!team) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="AHL Team not found" />
      </div>
    );
  }

  const loggedIn = await isLoggedIn();
  const { forwards, defense, goalies } = groupRoster(team.players.map((p) => ({ ...p, overall: livePlayerOverall(p) })));
  const avgAge = team.players.length > 0
    ? (team.players.reduce((s, p) => s + (p.age || 0), 0) / team.players.length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6 py-2">
      {/* BACK LINK */}
      <BackLink fallback="/ahl" label="Back to AHL Teams" />

      {/* HERO */}
      <section className="relative rounded-2xl overflow-hidden border border-slate-700/40 bg-gradient-to-r from-[#0a1f14] via-[#134e3a] to-[#0a1f14] shadow-lg shadow-black/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {team.logoUrl ? (
              <img src={team.logoUrl} alt={team.name} className="w-24 h-24 md:w-28 md:h-28 object-contain drop-shadow-2xl flex-shrink-0" />
            ) : (
              <div className="w-24 h-24 md:w-28 md:h-28 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl font-black text-slate-500 flex-shrink-0">{team.code || team.name[0]}</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight italic">{team.name}</h1>
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-500/20">AHL</span>
              </div>
              <div className="mt-1">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">NHL Affiliate</p>
                {team.parentTeam ? (
                  <Link href={`/teams/${team.parentTeam.slug}`} className="text-sm font-semibold text-emerald-300 hover:underline">{team.parentTeam.name}</Link>
                ) : (
                  <p className="text-sm font-semibold text-white">None</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile label="Players" value={String(team.players.length)} />
        <StatTile label="Avg Age" value={String(avgAge)} />
        <StatTile label="Affiliate Of" value={team.parentTeam?.code || team.parentTeam?.name || "—"} color="text-emerald-300" />
      </div>

      {/* ROSTER */}
      <div className="space-y-6">
        {forwards.length > 0 && <RosterSection title="Forwards" players={forwards} accent="text-emerald-300" farm hideAttrs={!loggedIn} />}
        {defense.length > 0 && <RosterSection title="Defensemen" players={defense} accent="text-emerald-300" farm hideAttrs={!loggedIn} />}
        {goalies.length > 0 && <RosterSection title="Goalies" players={goalies} accent="text-emerald-300" farm hideAttrs={!loggedIn} />}
        {team.players.length === 0 && <Card><p className="text-slate-500 text-center py-8">No players on roster</p></Card>}
      </div>
    </div>
  );
}
