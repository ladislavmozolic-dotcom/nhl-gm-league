import Link from "next/link";
import BackLink from "@/components/BackLink";
import { prisma } from "../../../lib/prisma";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";
import { PageHeader, Card, StatTile, SectionTitle } from "@/components/ui";

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
      players: {
        orderBy: {
          name: "asc",
        },
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

  const isFwd = (p: any) => !p.isGoalie && (p.position?.includes("C") || p.position?.includes("W") || p.position?.includes("F"));
  const forwards = team.players.filter(isFwd);
  const defense = team.players.filter((p) => !p.isGoalie && !isFwd(p) && p.position?.includes("D"));
  const goalies = team.players.filter((p) => p.isGoalie);
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
        {forwards.length > 0 && <RosterSection title="Forwards" players={forwards} />}
        {defense.length > 0 && <RosterSection title="Defensemen" players={defense} />}
        {goalies.length > 0 && <RosterSection title="Goalies" players={goalies} />}
        {team.players.length === 0 && <Card><p className="text-slate-500 text-center py-8">No players on roster</p></Card>}
      </div>
    </div>
  );
}

function RosterSection({ title, players }: { title: string; players: any[] }) {
  return (
    <div>
      <SectionTitle count={players.length} accent="text-emerald-300/80">{title}</SectionTitle>
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-wider bg-slate-800/30">
                <th className="px-3 py-3 text-left font-medium min-w-[160px]">Player</th>
                <th className="px-3 py-3 text-center font-medium w-14">Pos</th>
                <th className="px-3 py-3 text-center font-medium w-12">#</th>
                <th className="px-3 py-3 text-center font-medium w-12">Age</th>
                <th className="px-3 py-3 text-center font-medium w-12">OVR</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar src={player.photoUrl} alt={player.name} size={32} />
                      <Link href={`/players/${player.slug}`} className="font-medium text-sm hover:text-emerald-300 transition-colors truncate block">{cleanName(player.name)}</Link>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-400">{player.position}</td>
                  <td className="px-3 py-2.5 text-center text-slate-400 tabular-nums">{player.number ? `#${player.number}` : "—"}</td>
                  <td className="px-3 py-2.5 text-center text-slate-400 tabular-nums">{player.age || "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`font-bold ${(player.overall || 0) >= 80 ? "text-green-400" : (player.overall || 0) >= 70 ? "text-emerald-300" : (player.overall || 0) >= 60 ? "text-yellow-400" : "text-slate-400"}`}>{player.overall || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
