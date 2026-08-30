import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { PRE_SEASON } from "@/lib/phase";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

function ResultBadge({ result }: { result: "W" | "L" | "OTL" }) {
  const cls =
    result === "W"
      ? "bg-green-500/15 text-green-400 border-green-500/20"
      : result === "OTL"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
      : "bg-red-500/15 text-red-400 border-red-500/20";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
      {result}
    </span>
  );
}

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("sk-SK", { day: "numeric", month: "short" }) : "—");

type TeamGame = Awaited<ReturnType<typeof loadTeamGames>>[number];

async function loadTeamGames(season: string, league: string, teamId: number) {
  return prisma.game.findMany({
    where: { season, league, seriesId: null, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: [{ round: "asc" }, { gameDate: "asc" }],
    include: { homeTeam: { select: { code: true, logoUrl: true } }, awayTeam: { select: { code: true, logoUrl: true } } },
  });
}

function ScheduleTable({ title, accent, games, teamId }: { title: string; accent: string; games: TeamGame[]; teamId: number }) {
  return (
    <Card title={title} accent={accent} bodyClassName="p-0">
      {games.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No scheduled games.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium w-20">Date</th>
                <th className="px-4 py-3 text-left font-medium">Opponent</th>
                <th className="px-4 py-3 text-right font-medium w-28">Result</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const isHome = g.homeTeamId === teamId;
                const opp = isHome ? g.awayTeam : g.homeTeam;
                const isFinal = g.status === "FINAL";
                const teamGoals = isHome ? g.homeGoals : g.awayGoals;
                const oppGoals = isHome ? g.awayGoals : g.homeGoals;
                const won = g.winnerTeamId === teamId;
                const result: "W" | "L" | "OTL" = won ? "W" : g.endedIn && g.endedIn !== "REG" ? "OTL" : "L";
                return (
                  <tr key={g.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(g.gameDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 w-5 text-xs font-medium">{isHome ? "vs" : "@"}</span>
                        {opp.logoUrl && <img src={opp.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                        <span className="font-medium">{opp.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isFinal ? (
                        <Link href={`/games/${g.id}`} className="inline-flex items-center gap-2 justify-end hover:text-blue-400 transition-colors">
                          <span className="tabular-nums font-semibold">{teamGoals}-{oppGoals}</span>
                          <ResultBadge result={result} />
                        </Link>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default async function TeamSchedulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  const [games, admin, leagueCfg] = await Promise.all([
    loadTeamGames(SEASON, team.league, team.id),
    isAdmin(),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { preseasonPublic: true } }),
  ]);

  // Pre-season is NHL-only, same admin-or-public visibility rule as /preseason
  // and the main /schedule merge.
  const showPre = team.league === "NHL" && (admin || leagueCfg?.preseasonPublic);
  const preGames = showPre ? await loadTeamGames(PRE_SEASON, team.league, team.id) : [];

  return (
    <div className="space-y-6">
      {showPre && <ScheduleTable title="Pre-season Schedule" accent="text-sky-400" games={preGames} teamId={team.id} />}
      <ScheduleTable title="Regular Season Schedule" accent="text-blue-400" games={games} teamId={team.id} />
    </div>
  );
}
