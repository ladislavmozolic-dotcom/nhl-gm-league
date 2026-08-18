import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SeasonControls from "@/components/SeasonControls";
import { generateScheduleAction, playSeasonAction, runPlayoffsAction, resetSeasonAction, importNhlApiAction, importCsvAction, archiveSeasonAction, runRetirementsAction, developProspectsAction } from "./actions";
import RunAiGmButton from "@/components/RunAiGmButton";
import RestartSeasonButton from "@/components/RestartSeasonButton";
import { PageHeader, Card } from "@/components/ui";
import PrepareNextDraftButton from "@/components/PrepareNextDraftButton";
import PhaseControl from "@/components/PhaseControl";
import { getLeagueClock } from "@/lib/calendar-server";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function SeasonAdminPage() {
  const [played, scheduled, playoffSeries, finalDone, clock, cfg] = await Promise.all([
    prisma.game.count({ where: { season: SEASON, status: "FINAL", seriesId: null } }),
    prisma.game.count({ where: { season: SEASON, status: "SCHEDULED" } }),
    prisma.playoffSeries.count({ where: { season: SEASON } }),
    prisma.playoffSeries.findFirst({ where: { season: SEASON, round: 4, status: "DONE" }, select: { winnerTeamId: true } }),
    getLeagueClock(),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true } }),
  ]);
  const champ = finalDone?.winnerTeamId
    ? await prisma.team.findUnique({ where: { id: finalDone.winnerTeamId }, select: { name: true } })
    : null;

  const archived = await prisma.seasonRecord.findFirst({ where: { season: SEASON, league: "NHL" }, select: { id: true } });

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Season Control"
        subtitle={`${SEASON} — run the regular season and playoffs without scripts.`}
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>}
      />

      <Card title="League phase" accent="text-blue-400">
        <div className="space-y-2">
          <p className="text-sm text-slate-400">Set the phase manually — Off-season, Pre-season, Regular season or Playoffs — or leave it on <span className="text-slate-200">Auto</span> to follow the calendar. Leagues don&apos;t all run on the real dates.</p>
          <PhaseControl current={clock.phase} label={clock.phaseLabel} override={cfg?.phaseOverride ?? null} />
        </div>
      </Card>

      <SeasonControls
        state={{ played, scheduled, playoffSeries, champion: champ?.name ?? null }}
        actions={{ generateScheduleAction, playSeasonAction, runPlayoffsAction, resetSeasonAction, runRetirementsAction, developProspectsAction, importNhlApiAction, importCsvAction }}
      />

      <Card title="Restart season (keep schedule)" accent="text-rose-400">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-slate-400 max-w-xl">
            Revert every game to <span className="text-slate-200">unplayed</span> on the same fixtures — results, per-game stats,
            standings and playoffs wiped, conditions &amp; injuries reset. The <span className="text-slate-200">schedule stays</span>,
            so you can sim from day 1 again to watch the game flow and AI GM activity. Rosters are left as they are.
          </p>
          <RestartSeasonButton />
        </div>
      </Card>

      <Card title="AI GM (GM-less clubs)" accent="text-cyan-400">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-slate-400 max-w-xl">
            Every club with <span className="text-slate-200">no registered GM</span> is run by the AI GM: it picks a roster-fit
            tactical system, keeps a legal lineup, and sheds movable salary (two-way / ELC) to get <span className="text-slate-200">cap-compliant</span>.
            It never trades or signs free agents. This runs automatically before each simulated day — press to run it now.
          </p>
          <RunAiGmButton />
        </div>
      </Card>

      <Card title="Archive season → History" accent="text-amber-400">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-slate-400 max-w-xl">
            Snapshot final standings, champions and award winners (Hart, Art Ross, Rocket, Norris, Calder, Vezina, Conn Smythe) for
            both NHL & AHL into <span className="text-slate-200">League History</span>. Re-running replaces this season&apos;s entry.
            {archived && <span className="ml-1 text-green-400">Currently archived.</span>}
          </p>
          <form action={archiveSeasonAction}>
            <button className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-semibold text-sm whitespace-nowrap">
              {archived ? "Re-archive season" : "Archive season"}
            </button>
          </form>
        </div>
      </Card>

      <Card title="Off-season → Prepare next draft" accent="text-blue-400">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-slate-400 max-w-xl">
            Import the upcoming draft class from NHL Central Scouting so the next <span className="text-slate-200">Draft Room</span> has prospects.
            The completed draft moves into <span className="text-slate-200">Draft History</span> on its own as the draft year rolls; the order is set on the <span className="text-slate-200">Draft Lottery</span> page.
          </p>
          <PrepareNextDraftButton />
        </div>
      </Card>
    </div>
  );
}
