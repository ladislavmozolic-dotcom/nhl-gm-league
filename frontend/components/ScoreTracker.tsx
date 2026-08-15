import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Global score tracker shown at the top of every page — results only.
// (Goal scorers / assists live on the game-detail scoreboard.)
export default async function ScoreTracker() {
  const lastDay = await prisma.game.findFirst({
    where: { status: "FINAL", seriesId: null, gameDate: { not: null } },
    orderBy: { gameDate: "desc" },
    select: { gameDate: true },
  });
  if (!lastDay?.gameDate) return null;

  const start = new Date(lastDay.gameDate); start.setHours(0, 0, 0, 0);
  const end = new Date(lastDay.gameDate); end.setHours(23, 59, 59, 999);

  const games = await prisma.game.findMany({
    where: { status: "FINAL", seriesId: null, gameDate: { gte: start, lte: end } },
    select: {
      id: true, league: true, homeGoals: true, awayGoals: true,
      homeTeam: { select: { code: true, logoUrl: true } }, awayTeam: { select: { code: true, logoUrl: true } },
    },
    orderBy: { id: "asc" },
  });
  if (games.length === 0) return null;

  const TeamRow = ({ t, score, win }: { t: { code: string | null; logoUrl: string | null }; score: number | null; win: boolean }) => (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 min-w-0">
        {t.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 object-contain" />}
        <span className={`text-sm ${win ? "font-bold text-white" : "text-slate-400"}`}>{t.code}</span>
      </div>
      <span className={`text-base tabular-nums ${win ? "font-bold text-white" : "text-slate-400"}`}>{score ?? "–"}</span>
    </div>
  );

  return (
    <div className="bg-[#0a1628] border-b border-slate-800">
      <div className="max-w-[1400px] mx-auto flex items-stretch">
        <div className="shrink-0 bg-blue-600 text-white text-[11px] font-bold px-3 flex items-center uppercase tracking-wide">Scores</div>
        <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar">
          {games.map((g) => {
            const aw = (g.awayGoals ?? 0) > (g.homeGoals ?? 0), hw = (g.homeGoals ?? 0) > (g.awayGoals ?? 0);
            return (
              <Link key={g.id} href={`/games/${g.id}`} className="shrink-0 min-w-[128px] bg-slate-800/40 hover:bg-slate-800 rounded-lg px-3 py-1.5 border border-slate-800 transition-colors">
                <div className={`text-[9px] font-bold mb-0.5 ${g.league === "AHL" ? "text-emerald-400" : "text-slate-500"}`}>{g.league}</div>
                <TeamRow t={g.awayTeam} score={g.awayGoals} win={aw} />
                <TeamRow t={g.homeTeam} score={g.homeGoals} win={hw} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
