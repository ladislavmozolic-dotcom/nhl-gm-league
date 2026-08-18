import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import DaySimControls from "@/components/DaySimControls";
import ScrollToCurrent from "@/components/ScrollToCurrent";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const { league: leagueParam } = await searchParams;
  const league = leagueParam === "AHL" ? "AHL" : "NHL";

  const games = await prisma.game.findMany({
    where: { season: SEASON, league, seriesId: null },
    orderBy: [{ round: "asc" }, { gameDate: "asc" }, { id: "asc" }],
    include: { homeTeam: { select: { code: true, name: true, logoUrl: true } }, awayTeam: { select: { code: true, name: true, logoUrl: true } } },
  });
  const played = games.filter((g) => g.status === "FINAL").length;
  const otherLeague = league === "AHL" ? "NHL" : "AHL";
  const admin = await isAdmin();
  // the current day = the first not-yet-played game; admins jump here after a sim,
  // GMs land at the top and scroll down.
  const currentId = games.find((g) => g.status !== "FINAL")?.id;

  // global game number + group games by month
  const numById = new Map(games.map((g, i) => [g.id, i + 1]));
  const monthKey = (d: Date | null) => (d ? `${d.getUTCFullYear()}-${d.getUTCMonth()}` : "tbd");
  const monthLabel = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "Unscheduled");
  const months: { key: string; label: string; games: typeof games }[] = [];
  for (const g of games) {
    const k = monthKey(g.gameDate);
    let m = months[months.length - 1];
    if (!m || m.key !== k) { m = { key: k, label: monthLabel(g.gameDate), games: [] }; months.push(m); }
    m.games.push(g);
  }

  const TeamSide = ({ t, score, win, align }: { t: { code: string | null; name: string; logoUrl: string | null }; score: number | null; win: boolean; align: "left" | "right" }) => (
    <div className={`flex items-center gap-1.5 min-w-0 ${align === "right" ? "flex-row-reverse" : ""}`}>
      {t.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
      <span className={`truncate ${win ? "font-bold text-white" : "text-slate-300"}`}>{t.code ?? t.name}</span>
      {score != null && <span className={`tabular-nums w-5 text-center ${win ? "font-bold text-white" : "text-slate-400"}`}>{score}</span>}
    </div>
  );

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={`${league} Schedule`}
        subtitle={`${SEASON} • ${games.length} games • ${played} played`}
        right={
          <div className="flex gap-2 flex-wrap">
            <Link href={`/schedule${league === "AHL" ? "" : "?league=AHL"}`} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">{otherLeague}</Link>
            <Link href="/playoffs" className="px-3 py-1.5 rounded-lg border border-amber-700/50 text-amber-300 hover:bg-amber-950/30 text-sm">🏆 Playoffs</Link>
          </div>
        }
      />

      {admin && <DaySimControls />}
      {admin && currentId != null && <ScrollToCurrent />}

      <Card bodyClassName="p-0">
        {months.length === 0 && <p className="text-slate-500 text-center py-10">No games scheduled yet.</p>}
        {months.map((m) => (
          <div key={m.key}>
            <div className="px-4 py-2 bg-green-950/30 border-y border-green-500/40 flex items-center justify-between">
              <span className="text-sm font-bold text-green-400 uppercase tracking-wide">{m.label}</span>
              <span className="text-[11px] text-slate-500">{m.games.length} games</span>
            </div>
            <div className="divide-y divide-slate-800/60">
              {m.games.map((g) => {
                const homeWin = g.winnerTeamId === g.homeTeamId;
                const awayWin = g.winnerTeamId === g.awayTeamId;
                const isFinal = g.status === "FINAL";
                const tag = g.endedIn && g.endedIn !== "REG" ? g.endedIn : "";
                const row = (
                  <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-slate-800/30 transition-colors">
                    <span className="text-[11px] text-slate-600 tabular-nums w-8 shrink-0">#{numById.get(g.id)}</span>
                    <span className="text-[11px] text-slate-500 w-14 shrink-0">{fmtDate(g.gameDate)}</span>
                    <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-0">
                      <TeamSide t={g.awayTeam} score={isFinal ? g.awayGoals : null} win={awayWin} align="right" />
                      <span className="text-[11px] text-slate-600 px-1">{isFinal ? "" : "@"}</span>
                      <TeamSide t={g.homeTeam} score={isFinal ? g.homeGoals : null} win={homeWin} align="left" />
                    </div>
                    <span className={`text-[10px] font-semibold tracking-wide w-16 text-right shrink-0 ${isFinal ? "text-slate-500" : "text-blue-400/70"}`}>
                      {isFinal ? `FINAL${tag ? `/${tag}` : ""}` : "SCHEDULED"}
                    </span>
                  </div>
                );
                const anchor = g.id === currentId ? { id: "current-day", className: "scroll-mt-28 ring-1 ring-inset ring-blue-500/30 bg-blue-500/[0.04]" } : {};
                return isFinal ? (
                  <Link key={g.id} href={`/games/${g.id}`} className="block">{row}</Link>
                ) : (
                  <div key={g.id} {...anchor}>{row}</div>
                );
              })}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
