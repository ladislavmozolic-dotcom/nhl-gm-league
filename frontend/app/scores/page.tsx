import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import PhaseTabs from "@/components/PhaseTabs";
import { seasonForPhase, normalizePhase } from "@/lib/phase";
import { defaultStatsPhase } from "@/lib/calendar-server";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const pretty = (d: Date) => d.toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

type GameRow = {
  id: number; homeGoals: number | null; awayGoals: number | null; endedIn: string | null;
  homeTeam: { name: string; code: string | null; logoUrl: string | null; slug: string };
  awayTeam: { name: string; code: string | null; logoUrl: string | null; slug: string };
};

function ScoreCard({ g }: { g: GameRow }) {
  const hw = (g.homeGoals ?? 0) > (g.awayGoals ?? 0);
  const aw = (g.awayGoals ?? 0) > (g.homeGoals ?? 0);
  const Team = ({ t, goals, win }: { t: GameRow["homeTeam"]; goals: number | null; win: boolean }) => (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain shrink-0" />}
        <span className={`truncate text-sm ${win ? "font-bold text-white" : "text-slate-400"}`}>{t.name}</span>
      </div>
      <span className={`tabular-nums text-lg ${win ? "font-bold text-white" : "text-slate-400"}`}>{goals ?? "–"}</span>
    </div>
  );
  return (
    <Link href={`/games/${g.id}`} className="block bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 p-3 hover:border-slate-600 transition-colors">
      <div className="space-y-1.5">
        <Team t={g.awayTeam} goals={g.awayGoals} win={aw} />
        <Team t={g.homeTeam} goals={g.homeGoals} win={hw} />
      </div>
      {g.endedIn && g.endedIn !== "REG" && <div className="text-[10px] text-amber-400 font-bold mt-1.5 text-right">FINAL / {g.endedIn}</div>}
    </Link>
  );
}

export default async function ScoresPage({ searchParams }: { searchParams: Promise<{ date?: string; league?: string; phase?: string }> }) {
  const sp = await searchParams;
  // Explicit ?phase= always wins; otherwise default to the live league clock so
  // the scoreboard auto-shows pre-season games for the duration of that phase.
  const auto = sp.phase ? null : await defaultStatsPhase();
  const phase = sp.phase ? (normalizePhase(sp.phase) === "pre" ? "pre" : "regular") : (auto === "pre" ? "pre" : "regular"); // scoreboard: pre or regular (playoffs → /playoffs)
  const SEASON = seasonForPhase(phase);
  const onlyAhl = sp.league === "AHL" && phase !== "pre"; // pre-season is NHL-only
  const leagueFilter = onlyAhl ? { league: "AHL" } : {};
  const qPhase = phase === "pre" ? "&phase=pre" : "";
  const dates = await prisma.game.findMany({
    where: { season: SEASON, status: "FINAL", seriesId: null, gameDate: { not: null }, ...leagueFilter },
    select: { gameDate: true }, distinct: ["gameDate"], orderBy: { gameDate: "asc" },
  });
  const dayList = dates.map((d) => iso(d.gameDate!));
  const uniqueDays = [...new Set(dayList)];

  if (uniqueDays.length === 0) {
    return (
      <div className="space-y-4 py-2">
        <PageHeader title={phase === "pre" ? "Pre-season Scores" : "Scores"} subtitle="No games have been simulated yet." />
        <PhaseTabs active={phase} league={onlyAhl ? "AHL" : "NHL"} basePath="/scores" />
      </div>
    );
  }

  const date = sp.date;
  const current = date && uniqueDays.includes(date) ? date : uniqueDays[uniqueDays.length - 1];
  const idx = uniqueDays.indexOf(current);
  const prev = idx > 0 ? uniqueDays[idx - 1] : null;
  const next = idx < uniqueDays.length - 1 ? uniqueDays[idx + 1] : null;
  const qLeague = onlyAhl ? "&league=AHL" : "";

  const start = new Date(current + "T00:00:00.000Z");
  const end = new Date(current + "T23:59:59.999Z");
  const games = await prisma.game.findMany({
    where: { season: SEASON, status: "FINAL", seriesId: null, gameDate: { gte: start, lte: end }, ...leagueFilter },
    select: {
      id: true, league: true, homeGoals: true, awayGoals: true, endedIn: true,
      homeTeam: { select: { name: true, code: true, logoUrl: true, slug: true } },
      awayTeam: { select: { name: true, code: true, logoUrl: true, slug: true } },
    },
    orderBy: { id: "asc" },
  });
  const nhl = games.filter((g) => g.league === "NHL");
  const ahl = games.filter((g) => g.league === "AHL");

  return (
    <div className="py-2">
      <PageHeader
        title={`${onlyAhl ? "AHL " : ""}Scores`}
        right={
          <div className="flex items-center gap-2">
            {prev ? <Link href={`/scores?date=${prev}${qLeague}${qPhase}`} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm">← Prev</Link>
              : <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-700 text-sm">← Prev</span>}
            {next ? <Link href={`/scores?date=${next}${qLeague}${qPhase}`} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm">Next →</Link>
              : <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-700 text-sm">Next →</span>}
          </div>
        }
      />
      <div className="mt-2 mb-4"><PhaseTabs active={phase} league={onlyAhl ? "AHL" : "NHL"} basePath="/scores" /></div>
      <p className="text-slate-400 text-sm mb-6 capitalize">{pretty(new Date(current + "T12:00:00"))}{phase === "pre" ? " · Pre-season (exhibition)" : ""}</p>

      {!onlyAhl && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full" /> NHL <span className="text-slate-500 font-normal text-sm">({nhl.length})</span></h2>
          {nhl.length === 0 ? <p className="text-slate-600 text-sm">No NHL games.</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{nhl.map((g) => <ScoreCard key={g.id} g={g} />)}</div>
          )}
        </section>
      )}

      {phase !== "pre" && (
        <section>
          <h2 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full" /> AHL <span className="text-slate-500 font-normal text-sm">({ahl.length})</span></h2>
          {ahl.length === 0 ? <p className="text-slate-600 text-sm">No AHL games.</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{ahl.map((g) => <ScoreCard key={g.id} g={g} />)}</div>
          )}
        </section>
      )}
    </div>
  );
}
