import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { computeStandings } from "@/lib/sim/standings";
import TeamSubNav from "@/components/TeamSubNav";

const SEASON = "2026-27";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { affiliateTeams: { select: { slug: true }, take: 1 }, parentTeam: { select: { slug: true } } },
  });
  if (!team) return <>{children}</>; // page handles notFound()
  const farmSlug = team.affiliateTeams[0]?.slug ?? null;
  const parentSlug = team.parentTeam?.slug ?? null;

  const [session, standings] = await Promise.all([
    getTeamSession(),
    computeStandings(SEASON, team.league).catch(() => []),
  ]);
  const isGm = session === team.id;

  // this team's record + conference rank
  const row = standings.find((s: any) => s.teamId === team.id) as any;
  const confRows = row?.conference ? standings.filter((s: any) => s.conference === row.conference) : [];
  const rank = row ? confRows.findIndex((s: any) => s.teamId === team.id) + 1 : 0;
  const ord = (n: number) => {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="space-y-6 py-2">
      {/* Team identity bar */}
      <div className="flex items-center gap-4 flex-wrap">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt={team.name} className="w-14 h-14 object-contain flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center text-lg font-black text-slate-500">{team.code || team.name[0]}</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-black tracking-tight truncate">{team.name}</h1>
            {(team.league === "AHL" || team.isAffiliate) && <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">AHL</span>}
            {isGm && <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-500/30">GM Mode</span>}
          </div>
          {row && (
            <p className="text-xs text-slate-400 mt-0.5">
              {row.w}-{row.l}-{row.otl}, {row.points} pts{rank ? ` · ${ord(rank)} in ${row.conference}` : ""}
            </p>
          )}
        </div>
        {/* logout now lives in the top menu (under the GM nickname); only a contextual sign-in here */}
        {!isGm && (
          <div className="shrink-0">
            <Link href={`/teams/${slug}/login`} className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition-colors">GM Login</Link>
          </div>
        )}
      </div>

      <TeamSubNav slug={slug} isGm={isGm} isAffiliate={team.league === "AHL" || team.isAffiliate} farmSlug={farmSlug} parentSlug={parentSlug} />

      {children}
    </div>
  );
}
