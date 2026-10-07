import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { PRE_SEASON } from "@/lib/phase";
import { getLang } from "@/lib/lang-server";
import { t, type Lang } from "@/lib/i18n";

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

type TeamGame = Awaited<ReturnType<typeof loadTeamGames>>[number];

async function loadTeamGames(season: string, league: string, teamId: number) {
  return prisma.game.findMany({
    where: { season, league, seriesId: null, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: [{ round: "asc" }, { gameDate: "asc" }],
    include: { homeTeam: { select: { code: true, logoUrl: true, name: true } }, awayTeam: { select: { code: true, logoUrl: true, name: true } } },
  });
}

function ScheduleTable({
  title,
  accent,
  games,
  teamId,
  lang,
}: {
  title: string;
  accent: string;
  games: TeamGame[];
  teamId: number;
  lang: Lang;
}) {
  const isCs = lang === "cs";
  const locale = isCs ? "sk-SK" : lang === "de" ? "de-DE" : lang === "ru" ? "ru-RU" : "en-US";
  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" }) : "—";

  return (
    <Card title={title} accent={accent} bodyClassName="p-0">
      {games.length === 0 ? (
        <p className="text-slate-500 text-center py-8">{t(lang, "schedule.noGamesScheduled")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/40 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-bold w-24">
                  {isCs ? "Dátum" : lang === "de" ? "Datum" : lang === "ru" ? "Дата" : "Date"}
                </th>
                <th className="px-4 py-3 text-left font-bold">
                  {isCs ? "Súper" : lang === "de" ? "Gegner" : lang === "ru" ? "Соперник" : "Opponent"}
                </th>
                <th className="px-4 py-3 text-right font-bold w-32">
                  {isCs ? "Výsledok" : lang === "de" ? "Ergebnis" : lang === "ru" ? "Результат" : "Result"}
                </th>
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
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap font-medium">{fmtDate(g.gameDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 w-5 text-xs font-bold">{isHome ? "vs" : "@"}</span>
                        {opp.logoUrl && <img src={opp.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                        <span className="font-bold text-white">{opp.code}</span>
                        <span className="text-xs text-slate-400 hidden sm:inline truncate">({opp.name})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isFinal ? (
                        <Link href={`/games/${g.id}`} className="inline-flex items-center gap-2 justify-end hover:text-blue-400 transition-colors">
                          <span className="tabular-nums font-bold text-slate-100">{teamGoals}-{oppGoals}</span>
                          <ResultBadge result={result} />
                        </Link>
                      ) : (
                        <span className="text-[11px] font-semibold text-sky-400/90 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                          {t(lang, "schedule.scheduled")}
                        </span>
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

  const [games, admin, leagueCfg, lang] = await Promise.all([
    loadTeamGames(SEASON, team.league, team.id),
    isAdmin(),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { preseasonPublic: true } }),
    getLang(),
  ]);

  const showPre = admin || !!leagueCfg?.preseasonPublic;
  const preGames = showPre ? await loadTeamGames(PRE_SEASON, team.league, team.id) : [];

  const isCs = lang === "cs";

  return (
    <div className="space-y-6">
      {showPre && (
        <ScheduleTable
          title={isCs ? "Rozpis prípravy (Pre-season)" : "Pre-season Schedule"}
          accent="text-sky-400"
          games={preGames}
          teamId={team.id}
          lang={lang}
        />
      )}
      <ScheduleTable
        title={isCs ? "Rozpis základnej časti" : "Regular Season Schedule"}
        accent="text-blue-400"
        games={games}
        teamId={team.id}
        lang={lang}
      />
    </div>
  );
}
