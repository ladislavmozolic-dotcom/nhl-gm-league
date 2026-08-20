import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { preseasonSchedule, type PreGameRow } from "@/lib/preseason";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—";

function TeamSide({ t, goals, win, final }: { t: PreGameRow["home"]; goals: number | null; win: boolean; final: boolean }) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${final && !win ? "opacity-70" : ""}`}>
      {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain shrink-0" />}
      {t.slug
        ? <Link href={`/teams/${t.slug}`} className="truncate hover:text-blue-400 transition-colors">{t.name}</Link>
        : <span className="truncate">{t.name}</span>}
      {final && <span className={`ml-auto tabular-nums font-bold ${win ? "text-white" : "text-slate-400"}`}>{goals}</span>}
    </div>
  );
}

function GameCard({ g }: { g: PreGameRow }) {
  const final = g.status === "FINAL";
  const homeWin = final && g.winnerTeamId === g.home.id;
  const awayWin = final && g.winnerTeamId === g.away.id;
  return (
    <Link href={final ? `/games/${g.id}` : "#"} className={`block rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-sm space-y-1.5 ${final ? "hover:border-slate-600 transition-colors" : "cursor-default"}`}>
      <TeamSide t={g.away} goals={g.awayGoals} win={awayWin} final={final} />
      <TeamSide t={g.home} goals={g.homeGoals} win={homeWin} final={final} />
      <div className="text-[10px] uppercase tracking-wide text-slate-500 pt-0.5">
        {final ? (g.endedIn && g.endedIn !== "REG" ? `Final / ${g.endedIn}` : "Final") : "Scheduled"}
      </div>
    </Link>
  );
}

export default async function PreseasonPage() {
  const { rounds, hasSchedule } = await preseasonSchedule();

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Pre-season" subtitle="Exhibition games before the regular season — results don't count in the standings or stats." />
      {!hasSchedule ? (
        <Card><p className="text-sm text-slate-400">No pre-season schedule yet. The commissioner generates it from <span className="text-slate-200">Admin → Season Control → Pre-season</span>.</p></Card>
      ) : (
        rounds.map((r) => (
          <section key={r.round} className="space-y-3">
            <h2 className="text-sm font-bold text-sky-400 uppercase tracking-wide">Game {r.round + 1} · <span className="text-slate-400 normal-case font-medium">{fmtDate(r.date)}</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {r.games.map((g) => <GameCard key={g.id} g={g} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
