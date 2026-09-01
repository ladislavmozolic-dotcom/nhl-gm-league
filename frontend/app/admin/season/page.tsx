import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SeasonControls from "@/components/SeasonControls";
import { generateScheduleAction, playSeasonAction, runPlayoffsAction, resetSeasonAction, importNhlApiAction, importCsvAction, archiveSeasonAction, runRetirementsAction, developProspectsAction } from "./actions";
import RunAiGmButton from "@/components/RunAiGmButton";
import RestartSeasonButton from "@/components/RestartSeasonButton";
import { PageHeader, Card } from "@/components/ui";
import PrepareNextDraftButton from "@/components/PrepareNextDraftButton";
import DraftPickControls from "@/components/DraftPickControls";
import PhaseControl from "@/components/PhaseControl";
import PhaseDatesControl from "@/components/PhaseDatesControl";
import PreseasonControls from "@/components/PreseasonControls";
import PlayoffStartControls from "@/components/PlayoffStartControls";
import { getLeagueClock } from "@/lib/calendar-server";
import { PRE_SEASON } from "@/lib/preseason";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

// The evening sim advances `lastSimulatedDay` by one league day per real day while in
// Auto mode. Since that field is day-granularity (not a precise timestamp — the
// calendar can now roll over at midnight independently of the 20:30 sim, see
// lib/season-cron.ts), staleness is measured in whole days behind real time, not
// hours: 0-1 days behind is the normal steady state (today's window just hasn't
// fired yet), 2+ means at least one full evening window was missed with no catch-up.
const STALE_DAYS = 2;

/** Visible health check for the automatic daily-sim cron (lib/season-cron.ts) — so a
 *  silently-failed cron (server down at 20:30, crontab lost on a box rebuild, etc.)
 *  shows up here on next admin visit instead of only being noticed when someone
 *  wonders why the standings haven't moved in days. */
function AutoAdvanceHealth({ pinned, lastSimDay }: { pinned: boolean; lastSimDay: Date | null }) {
  if (pinned) {
    return <p className="text-xs text-slate-500">⏸ Automatic daily sim is paused — a phase is pinned manually.</p>;
  }
  if (!lastSimDay) {
    return <p className="text-xs text-amber-400">⚠ Automatic daily sim hasn&apos;t run yet since this was set up.</p>;
  }
  const todayUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const daysAgo = Math.round((todayUtc - lastSimDay.getTime()) / 86_400_000);
  const when = lastSimDay.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  if (daysAgo >= STALE_DAYS) {
    return (
      <p className="text-xs text-red-400">
        ⚠ Automatic daily sim hasn&apos;t run in {daysAgo} days (last simulated league day: {when}). Check the server crontab
        and <code className="text-red-300">/var/log/unhl-cron.log</code> — see DEPLOY.md §10b.
      </p>
    );
  }
  return <p className="text-xs text-emerald-400">✓ Automatic daily sim is current — last simulated league day {when} ({daysAgo === 0 ? "today" : "yesterday"}).</p>;
}

export default async function SeasonAdminPage() {
  const [played, scheduled, playoffSeries, finalDone, clock, cfg, preScheduled, prePlayed] = await Promise.all([
    prisma.game.count({ where: { season: SEASON, status: "FINAL", seriesId: null } }),
    prisma.game.count({ where: { season: SEASON, status: "SCHEDULED" } }),
    prisma.playoffSeries.count({ where: { season: SEASON } }),
    prisma.playoffSeries.findFirst({ where: { season: SEASON, round: 4, status: "DONE" }, select: { winnerTeamId: true } }),
    getLeagueClock(),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { phaseOverride: true, lastSimulatedDay: true, preseasonPublic: true, preseasonPhaseAt: true, regularPhaseAt: true } }),
    prisma.game.count({ where: { season: PRE_SEASON, status: "SCHEDULED" } }),
    prisma.game.count({ where: { season: PRE_SEASON, status: "FINAL" } }),
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
          <AutoAdvanceHealth pinned={!!cfg?.phaseOverride} lastSimDay={cfg?.lastSimulatedDay ?? null} />
          <div className="pt-2 border-t border-slate-800">
            <PhaseDatesControl preseasonAt={cfg?.preseasonPhaseAt?.toISOString() ?? null} regularAt={cfg?.regularPhaseAt?.toISOString() ?? null} />
          </div>
        </div>
      </Card>

      <Card title="Pre-season (exhibition)" accent="text-sky-400">
        <PreseasonControls scheduled={preScheduled} played={prePlayed} isPublic={!!cfg?.preseasonPublic} />
      </Card>

      <Card title="Playoffs (day-by-day)" accent="text-orange-400">
        <PlayoffStartControls />
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

      <Card title="Draft-pick horizon" accent="text-blue-400">
        <p className="text-sm text-slate-400 mb-3 max-w-xl">Give every club its <b>own</b> picks (all 7 rounds) for a rolling 5-year window — no real-NHL trades. Shown on each team&apos;s <span className="text-slate-200">Draft Picks</span> page and in <span className="text-slate-200">All Rosters</span>. Run <b>Roll draft year forward</b> once per season so the horizon always stays 5 years out.</p>
        <DraftPickControls />
      </Card>
    </div>
  );
}
