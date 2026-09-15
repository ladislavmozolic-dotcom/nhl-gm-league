import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NewsTicker from "@/components/NewsTicker";

type TeamLite = { code: string | null; logoUrl: string | null };

const dateStr = (d: Date) => d.toLocaleDateString("sk-SK", { day: "numeric", month: "short" });

const TeamRow = ({ t, score, win }: { t: TeamLite; score: number | null; win: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-1.5 min-w-0">
      {t.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 object-contain" />}
      <span className={`text-sm ${win ? "font-bold text-white" : "text-slate-400"}`}>{t.code}</span>
    </div>
    {score != null && <span className={`text-base tabular-nums ${win ? "font-bold text-white" : "text-slate-400"}`}>{score}</span>}
  </div>
);

// Global scoreboard shown at the top of every page, right under the League
// News ticker — the latest simmed day's results (clickable through to the
// box score), and, once known, the next day's matchups. Goal scorers /
// assists live on the game-detail scoreboard, not here.
export default async function ScoreTracker() {
  const [lastDay, nextDay] = await Promise.all([
    prisma.game.findFirst({ where: { status: "FINAL", seriesId: null, league: "NHL", gameDate: { not: null } }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
    prisma.game.findFirst({ where: { status: "SCHEDULED", seriesId: null, league: "NHL", gameDate: { not: null } }, orderBy: { gameDate: "asc" }, select: { gameDate: true } }),
  ]);

  let results: { id: number; homeGoals: number | null; awayGoals: number | null; homeTeam: TeamLite; awayTeam: TeamLite }[] = [];
  if (lastDay?.gameDate) {
    const start = new Date(lastDay.gameDate); start.setHours(0, 0, 0, 0);
    const end = new Date(lastDay.gameDate); end.setHours(23, 59, 59, 999);
    results = await prisma.game.findMany({
      where: { status: "FINAL", seriesId: null, league: "NHL", gameDate: { gte: start, lte: end } },
      select: { id: true, homeGoals: true, awayGoals: true, homeTeam: { select: { code: true, logoUrl: true } }, awayTeam: { select: { code: true, logoUrl: true } } },
      orderBy: { id: "asc" },
    });
  }

  let upcoming: { id: number; homeTeam: TeamLite; awayTeam: TeamLite }[] = [];
  if (nextDay?.gameDate) {
    const start = new Date(nextDay.gameDate); start.setHours(0, 0, 0, 0);
    const end = new Date(nextDay.gameDate); end.setHours(23, 59, 59, 999);
    upcoming = await prisma.game.findMany({
      where: { status: "SCHEDULED", seriesId: null, league: "NHL", gameDate: { gte: start, lte: end } },
      select: { id: true, homeTeam: { select: { code: true, logoUrl: true } }, awayTeam: { select: { code: true, logoUrl: true } } },
      orderBy: { id: "asc" },
    });
  }

  return (
    <>
      <NewsTicker />
      {results.length > 0 && (
        <div className="bg-[#0a1628] border-b border-slate-800">
          <div className="max-w-[1400px] mx-auto flex items-stretch">
            <div className="shrink-0 bg-blue-600 text-white text-[11px] font-bold px-3 flex flex-col items-start justify-center leading-tight uppercase tracking-wide">
              <span>Scores</span>
              {lastDay?.gameDate && <span className="text-[10px] font-normal normal-case text-blue-100">{dateStr(lastDay.gameDate)}</span>}
            </div>
            <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar">
              {results.map((g) => {
                const aw = (g.awayGoals ?? 0) > (g.homeGoals ?? 0), hw = (g.homeGoals ?? 0) > (g.awayGoals ?? 0);
                return (
                  <Link key={g.id} href={`/games/${g.id}`} className="shrink-0 min-w-[128px] bg-slate-800/40 hover:bg-slate-800 rounded-lg px-3 py-1.5 border border-slate-800 transition-colors">
                    <TeamRow t={g.awayTeam} score={g.awayGoals} win={aw} />
                    <TeamRow t={g.homeTeam} score={g.homeGoals} win={hw} />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="bg-[#0a1628] border-b border-slate-800">
          <div className="max-w-[1400px] mx-auto flex items-stretch">
            <div className="shrink-0 bg-emerald-700 text-white text-[11px] font-bold px-3 flex flex-col items-start justify-center leading-tight uppercase tracking-wide">
              <span>Next</span>
              {nextDay?.gameDate && <span className="text-[10px] font-normal normal-case text-emerald-100">{dateStr(nextDay.gameDate)}</span>}
            </div>
            <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar">
              {upcoming.map((g) => (
                <div key={g.id} className="shrink-0 min-w-[128px] bg-slate-800/40 rounded-lg px-3 py-1.5 border border-slate-800">
                  <TeamRow t={g.awayTeam} score={null} win={false} />
                  <TeamRow t={g.homeTeam} score={null} win={false} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
