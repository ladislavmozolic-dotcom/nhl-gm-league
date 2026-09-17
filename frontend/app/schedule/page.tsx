import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import DaySimControls from "@/components/DaySimControls";
import ScrollToCurrent from "@/components/ScrollToCurrent";
import { PRE_SEASON } from "@/lib/phase";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const { league: leagueParam } = await searchParams;
  const league = leagueParam === "AHL" ? "AHL" : "NHL";

  const [games, admin, leagueCfg] = await Promise.all([
    prisma.game.findMany({
      where: { season: SEASON, league, seriesId: null },
      orderBy: [{ round: "asc" }, { gameDate: "asc" }, { id: "asc" }],
      include: { homeTeam: { select: { code: true, name: true, logoUrl: true } }, awayTeam: { select: { code: true, name: true, logoUrl: true } } },
    }),
    isAdmin(),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { preseasonPublic: true } }),
  ]);
  const played = games.filter((g) => g.status === "FINAL").length;
  const otherLeague = league === "AHL" ? "NHL" : "AHL";
  // the current day = the first not-yet-played game; admins jump here after a sim,
  // GMs land at the top and scroll down.
  const currentId = games.find((g) => g.status !== "FINAL")?.id;

  // global game number for the REGULAR season only — pre-season games below are
  // merged into the same chronological timeline but never take a #N slot, so the
  // official numbering is unaffected by whether pre-season happens to be showing.
  const numById = new Map(games.map((g, i) => [g.id, i + 1]));

  // Pre-season merges into the same league timeline, right before the regular
  // season it leads into — same visibility rule as the dedicated /preseason page:
  // admin-only until LeagueConfig.preseasonPublic is on.
  const preGames = admin || leagueCfg?.preseasonPublic
    ? await prisma.game.findMany({
        where: { season: PRE_SEASON, league },
        orderBy: [{ round: "asc" }, { id: "asc" }],
        include: { homeTeam: { select: { code: true, name: true, logoUrl: true } }, awayTeam: { select: { code: true, name: true, logoUrl: true } } },
      })
    : [];

  const allGames = [...preGames.map((g) => ({ ...g, isPre: true as const })), ...games.map((g) => ({ ...g, isPre: false as const }))]
    .sort((a, b) => (a.gameDate?.getTime() ?? 0) - (b.gameDate?.getTime() ?? 0));

  // group games by month and then by day
  const monthKey = (d: Date | null) => (d ? `${d.getUTCFullYear()}-${d.getUTCMonth()}` : "tbd");
  const monthLabel = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "Unscheduled");
  const dayKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "tbd");
  const dayLabel = (d: Date | null) =>
    d ? d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Unscheduled";
  const fmtDayShort = (d: Date | null) =>
    d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "—";

  type DayGroup = { key: string; label: string; shortLabel: string; games: typeof allGames };
  type MonthGroup = { key: string; label: string; totalGames: number; days: DayGroup[] };

  const months: MonthGroup[] = [];
  for (const g of allGames) {
    const mk = monthKey(g.gameDate);
    let m = months[months.length - 1];
    if (!m || m.key !== mk) {
      m = { key: mk, label: monthLabel(g.gameDate), totalGames: 0, days: [] };
      months.push(m);
    }
    m.totalGames++;

    const dk = dayKey(g.gameDate);
    let d = m.days[m.days.length - 1];
    if (!d || d.key !== dk) {
      d = { key: dk, label: dayLabel(g.gameDate), shortLabel: fmtDayShort(g.gameDate), games: [] };
      m.days.push(d);
    }
    d.games.push(g);
  }

  const TeamSide = ({
    t,
    score,
    win,
    align,
  }: {
    t: { code: string | null; name: string; logoUrl: string | null };
    score: number | null;
    win: boolean;
    align: "left" | "right";
  }) => (
    <div className={`flex items-center gap-2 min-w-0 ${align === "right" ? "flex-row-reverse text-right" : "text-left"}`}>
      {t.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0" />}
      <span className={`truncate text-sm ${win ? "font-bold text-white" : "text-slate-300"}`}>
        <span className="hidden md:inline">{t.name}</span>
        <span className="md:hidden">{t.code ?? t.name}</span>
      </span>
      {score != null && (
        <span className={`tabular-nums text-sm px-1.5 py-0.5 rounded font-bold shrink-0 ${
          win ? "bg-white/10 text-white" : "text-slate-400"
        }`}>
          {score}
        </span>
      )}
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

      {admin && (
        <div className="sticky top-14 z-30 -mx-4 px-4 py-2 bg-[#0a1628] border-b border-slate-800/50">
          <DaySimControls />
        </div>
      )}
      {admin && currentId != null && <ScrollToCurrent />}

      <Card bodyClassName="p-0">
        {months.length === 0 && <p className="text-slate-500 text-center py-10">No games scheduled yet.</p>}
        {months.map((m) => (
          <div key={m.key}>
            <div className="px-4 py-2.5 bg-green-950/40 border-y border-green-500/40 flex items-center justify-between">
              <span className="text-sm font-bold text-green-400 uppercase tracking-wide">{m.label}</span>
              <span className="text-xs text-slate-400 font-medium">{m.totalGames} games</span>
            </div>
            <div>
              {m.days.map((d) => (
                <div key={d.key} className="border-t-2 border-slate-700/80 first:border-t-0">
                  <div className="px-3 sm:px-4 py-1.5 bg-slate-800/60 border-b border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-200 tracking-wide">{d.label}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{d.games.length} {d.games.length === 1 ? "game" : "games"}</span>
                  </div>
                  <div className="divide-y divide-slate-800/50">
                    {d.games.map((g) => {
                      const homeWin = g.winnerTeamId === g.homeTeamId;
                      const awayWin = g.winnerTeamId === g.awayTeamId;
                      const isFinal = g.status === "FINAL";
                      const tag = g.endedIn && g.endedIn !== "REG" ? g.endedIn : "";
                      const row = (
                        <div className={`flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 hover:bg-slate-800/40 transition-colors ${g.isPre ? "bg-sky-950/20" : ""}`}>
                          <span className={`text-[11px] tabular-nums w-8 sm:w-10 shrink-0 ${g.isPre ? "text-sky-400 font-semibold" : "text-slate-500 font-mono"}`}>
                            {g.isPre ? "PRE" : `#${numById.get(g.id)}`}
                          </span>
                          <span className="hidden sm:inline-block text-xs text-slate-400 w-28 shrink-0 font-medium truncate">
                            {d.shortLabel}
                          </span>
                          <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 min-w-0">
                            <TeamSide t={g.awayTeam} score={isFinal ? g.awayGoals : null} win={awayWin} align="right" />
                            <span className="text-xs text-slate-500 font-semibold px-1 text-center shrink-0">
                              {isFinal ? "-" : "@"}
                            </span>
                            <TeamSide t={g.homeTeam} score={isFinal ? g.homeGoals : null} win={homeWin} align="left" />
                          </div>
                          <div className="w-20 sm:w-28 text-right shrink-0">
                            {isFinal ? (
                              <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                tag ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-slate-800 text-slate-300 border border-slate-700/60"
                              }`}>
                                FINAL{tag ? `/${tag}` : ""}
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-semibold text-blue-400/90 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 tracking-wide">
                                SCHEDULED
                              </span>
                            )}
                          </div>
                        </div>
                      );
                      const anchor = g.id === currentId ? { id: "current-day", className: "scroll-mt-36 ring-1 ring-inset ring-blue-500/30 bg-blue-500/[0.04]" } : {};
                      return isFinal ? (
                        <Link key={g.id} href={`/games/${g.id}`} className="block">{row}</Link>
                      ) : (
                        <div key={g.id} {...anchor}>{row}</div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
