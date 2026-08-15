import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { getLeagueClock } from "@/lib/calendar-server";
import { utcDay, addDays, fmtLeagueDate, SEASON_LABEL } from "@/lib/calendar";
import { PageHeader, Card } from "@/components/ui";
import CalendarControls from "@/components/CalendarControls";

export const dynamic = "force-dynamic";

const PHASE_BLURB: Record<string, string> = {
  frenzy: "Free Agent Frenzy is open — three weekly rounds. Players open high (week 1) and their asks come down toward fair value by week 3, when each signs the best standing offer (money + role + contention).",
  offseason: "The quiet off-season — re-signings, trades and roster housekeeping. The next milestone is preseason in late September.",
  preseason: "Preseason. Rosters get finalized and conditioning ramps up before opening night on October 1.",
  regular: "Regular season. Advancing a day plays that night's games (or recovers conditioning on an off-day).",
  playoffs: "Playoffs. Win-or-go-home — advance day by day through each round.",
};

export default async function CalendarPage() {
  const [admin, clock] = await Promise.all([isAdmin(), getLeagueClock()]);
  const dateISO = utcDay(clock.date).toISOString().slice(0, 10);

  const upcoming = await prisma.game.findMany({
    where: { season: SEASON_LABEL, status: "SCHEDULED", gameDate: { gte: addDays(clock.date, 1) } },
    orderBy: [{ gameDate: "asc" }], take: 6,
    select: { id: true, gameDate: true, homeTeam: { select: { code: true } }, awayTeam: { select: { code: true } } },
  });
  const nextDate = upcoming[0]?.gameDate ?? null;
  const nextDayGames = nextDate
    ? upcoming.filter((g) => g.gameDate && utcDay(g.gameDate).getTime() === utcDay(nextDate).getTime())
    : [];

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="League Calendar"
        subtitle={`${SEASON_LABEL} — the league runs July 1 through June 30, one day at a time`}
        right={admin ? <Link href="/admin/season" className="text-sm text-slate-400 hover:text-blue-400">Season Control →</Link> : undefined}
      />

      <CalendarControls
        isAdmin={admin}
        dateISO={dateISO}
        dateLabel={fmtLeagueDate(clock.date)}
        phaseLabel={clock.phaseLabel}
        phase={clock.phase}
        frenzyDay={clock.frenzyDay}
      />

      <Card title="This phase" accent="text-blue-400">
        <p className="text-sm text-slate-300">{PHASE_BLURB[clock.phase] ?? PHASE_BLURB.offseason}</p>
        {clock.frenzyOpen && (
          <p className="text-sm mt-2">
            <Link href="/free-agents" className="text-amber-300 hover:text-amber-200 font-semibold">→ Open the Free Agent Frenzy board</Link>
          </p>
        )}
      </Card>

      <Card title="Next scheduled games" accent="text-blue-400">
        {nextDate ? (
          <div className="text-sm text-slate-300">
            <div className="text-slate-400 mb-1">{fmtLeagueDate(nextDate)}</div>
            <div className="flex flex-wrap gap-2">
              {nextDayGames.map((g) => (
                <span key={g.id} className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700 tabular-nums">
                  {g.awayTeam?.code} @ {g.homeTeam?.code}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No games scheduled ahead — generate a schedule in Season Control.</p>
        )}
      </Card>
    </div>
  );
}
