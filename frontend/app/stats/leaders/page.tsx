import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PlayerLink from "@/components/PlayerLink";
import { skaterTotals, goalieTotals, type SkaterTotal, type GoalieTotal } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import PhaseTabs from "@/components/PhaseTabs";
import { seasonForPhase } from "@/lib/phase";
import { defaultStatsPhase } from "@/lib/calendar-server";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { getTeamSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Row = { playerId: number; name: string; teamId: number | null; teamCode: string | null; teamSlug: string | null; teamLogo: string | null; value: string; sub?: string };

function LeaderCard({ title, rows, managedTeamIds }: { title: string; rows: Row[]; managedTeamIds: Set<number> }) {
  return (
    <Card title={title} bodyClassName="p-0">
      <div className="divide-y divide-slate-800/60">
        {rows.length === 0 && <div className="px-4 py-4 text-slate-600 text-sm">no data</div>}
        {rows.map((r, i) => {
          const isMine = r.teamId != null && managedTeamIds.has(r.teamId);
          return (
          <div key={`${r.playerId}:${r.teamId ?? "none"}`} className={`flex items-center gap-2 px-4 py-1.5 text-sm transition-colors ${isMine ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/25 hover:bg-emerald-500/15" : "hover:bg-slate-800/30"}`}>
            <span className={`w-5 text-right tabular-nums ${i === 0 ? "text-amber-400 font-bold" : "text-slate-500"}`}>{i + 1}</span>
            <span className="flex-1 truncate">
              <PlayerLink id={r.playerId} name={r.name} clean={false} className={isMine ? "text-emerald-300 font-semibold hover:text-emerald-200" : undefined} />
              {r.teamCode && (
                <Link href={r.teamSlug ? `/teams/${r.teamSlug}` : "#"} className="inline-flex items-center gap-1 ml-1.5 align-middle text-slate-500 text-xs hover:text-blue-400 transition-colors">
                  {r.teamLogo && <img src={r.teamLogo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                  {r.teamCode}
                </Link>
              )}
            </span>
            {r.sub && <span className="tabular-nums text-[10px] text-slate-500 shrink-0">{r.sub}</span>}
            <span className="tabular-nums font-semibold">{r.value}</span>
          </div>
          );
        })}
      </div>
    </Card>
  );
}

const top = <T,>(arr: T[], key: (t: T) => number, n = 10) => [...arr].sort((a, b) => key(b) - key(a)).slice(0, n);
const skRow = (s: SkaterTotal, value: string, sub?: string): Row => ({ playerId: s.playerId, name: s.name, teamId: s.teamId, teamCode: s.teamCode, teamSlug: s.teamSlug, teamLogo: s.teamLogo, value, sub });
const gkRow = (g: GoalieTotal, value: string, sub?: string): Row => ({ playerId: g.playerId, name: g.name, teamId: g.teamId, teamCode: g.teamCode, teamSlug: g.teamSlug, teamLogo: g.teamLogo, value, sub });

export default async function LeadersPage({ searchParams }: { searchParams: Promise<{ league?: string; phase?: string }> }) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const explicit = sp.phase === "pre" || sp.phase === "regular" ? sp.phase : null;
  const auto = league === "NHL" ? await defaultStatsPhase() : "regular";
  const phase: "pre" | "regular" = league !== "NHL" ? "regular" : explicit ?? (auto === "playoffs" ? "regular" : auto);
  const SEASON = seasonForPhase(phase);
  const sessionTeamId = await getTeamSession();
  const [sk, gk, finals, managedTeams] = await Promise.all([
    skaterTotals(SEASON, league),
    goalieTotals(SEASON, league),
    prisma.game.findMany({ where: { season: SEASON, league, status: "FINAL" }, select: { homeTeamId: true, awayTeamId: true } }),
    sessionTeamId == null
      ? Promise.resolve([])
      : prisma.team.findMany({ where: { OR: [{ id: sessionTeamId }, { parentTeamId: sessionTeamId }] }, select: { id: true } }),
  ]);
  const managedTeamIds = new Set(managedTeams.map((t) => t.id));
  const mins = (toi: number) => Math.round(toi / 60);

  // Games each team has completed → drives the rate-stat (SV%, GAA) qualifier.
  const teamGP = new Map<number, number>();
  for (const g of finals) {
    teamGP.set(g.homeTeamId, (teamGP.get(g.homeTeamId) ?? 0) + 1);
    teamGP.set(g.awayTeamId, (teamGP.get(g.awayTeamId) ?? 0) + 1);
  }

  const skaterCards: Array<{ title: string; rows: Row[] }> = [
    { title: "Goals", rows: top(sk, (s) => s.goals).map((s) => skRow(s, String(s.goals), `${s.gp} GP`)) },
    { title: "Assists", rows: top(sk, (s) => s.assists).map((s) => skRow(s, String(s.assists), `${s.gp} GP`)) },
    { title: "Points", rows: top(sk, (s) => s.points).map((s) => skRow(s, String(s.points), `${s.goals}G+${s.assists}A`)) },
    { title: "Defensemen (points)", rows: top(sk.filter((s) => s.position.includes("D")), (s) => s.points).map((s) => skRow(s, String(s.points), `${s.goals}G+${s.assists}A`)) },
    { title: "Rookies (points)", rows: top(sk.filter((s) => s.rookie), (s) => s.points).map((s) => skRow(s, String(s.points), `${s.goals}G+${s.assists}A`)) },
    { title: "Plus / Minus (5-on-5)", rows: top(sk, (s) => s.plusMinus5v5).map((s) => skRow(s, (s.plusMinus5v5 > 0 ? "+" : "") + s.plusMinus5v5, `${s.gp} GP`)) },
    { title: "Goals Above Expected (G-xG)", rows: top(sk, (s) => s.goals - s.xg).map((s) => skRow(s, (s.goals - s.xg).toFixed(1), `${s.goals}G · ${s.xg.toFixed(1)} xG`)) },
    { title: "Minutes Played", rows: top(sk, (s) => s.toi).map((s) => skRow(s, String(mins(s.toi)), `${s.gp} GP`)) },
    { title: "Penalty Minutes", rows: top(sk, (s) => s.pim).map((s) => skRow(s, String(s.pim), `${s.gp} GP`)) },
    { title: "Shots", rows: top(sk, (s) => s.shots).map((s) => skRow(s, String(s.shots), `${s.gp} GP`)) },
    { title: "Power-Play Goals", rows: top(sk, (s) => s.ppGoals).map((s) => skRow(s, String(s.ppGoals), `${s.gp} GP`)) },
    { title: "Short-Handed Goals", rows: top(sk, (s) => s.shGoals).map((s) => skRow(s, String(s.shGoals), `${s.gp} GP`)) },
    { title: "Game-Winning Goals", rows: top(sk, (s) => s.gwg).map((s) => skRow(s, String(s.gwg), `${s.gp} GP`)) },
    { title: "Hits", rows: top(sk, (s) => s.hits).map((s) => skRow(s, String(s.hits), `${s.gp} GP`)) },
    { title: "Shots Blocked", rows: top(sk, (s) => s.blocks).map((s) => skRow(s, String(s.blocks), `${s.gp} GP`)) },
  ];

  // Rate stats (SV%, GAA) need a sample so a hot 2-3 game backup doesn't top the
  // leaderboard. A goalie must have played at least 20% of his OWN team's games:
  // 84 GP season → ~17 GP, 42 GP → ~8 GP. Early on (<10 team games) 20% is ~1-2, so
  // we still see everyone with a couple of starts.
  const QUAL_PCT = 0.2;
  const gkMinFor = (tid: number | null) => {
    const tg = (tid != null ? teamGP.get(tid) : 0) ?? 0;
    return Math.max(1, Math.round(QUAL_PCT * tg));
  };
  const qualGk = gk.filter((g) => g.gp >= gkMinFor(g.teamId));
  const maxTeamGP = Math.max(0, ...teamGP.values());
  const repMin = Math.max(1, Math.round(QUAL_PCT * maxTeamGP));
  const goalieCards: Array<{ title: string; rows: Row[] }> = [
    { title: "Wins", rows: top(gk, (g) => g.wins).map((g) => gkRow(g, String(g.wins), `${g.gp} GP`)) },
    { title: "Save Percentage", rows: top(qualGk, (g) => g.svPct).map((g) => gkRow(g, g.svPct.toFixed(3).replace(/^0/, ""), `${g.gp} GP`)) },
    { title: "Goals-Against Average", rows: top(qualGk, (g) => -g.gaa).map((g) => gkRow(g, g.gaa.toFixed(2), `${g.gp} GP`)) },
    { title: "Minutes Played", rows: top(gk, (g) => g.toiMin).map((g) => gkRow(g, String(g.toiMin), `${g.gp} GP`)) },
    { title: "Shutouts", rows: top(gk, (g) => g.shutouts).map((g) => gkRow(g, String(g.shutouts), `${g.gp} GP`)) },
  ];

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle="League leaders across skaters and goalies" />
      <StatsTabs active="leaders" league={league} />
      <PhaseTabs active={phase} league={league} basePath="/stats/leaders" showPlayoffs={false} />
      {phase === "pre" && <p className="text-xs text-amber-400/90">Pre-season (exhibition) — these stats don&apos;t count toward player profiles or careers.</p>}

      <section>
        <SectionTitle accent="text-blue-400">Skater Leaders — {league} {SEASON}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skaterCards.map((c) => <LeaderCard key={c.title} title={c.title} rows={c.rows} managedTeamIds={managedTeamIds} />)}
        </div>
      </section>

      <section>
        <SectionTitle accent="text-red-400">Goalie Leaders — SV%/GAA need ≥20% of team games ({repMin}+ GP)</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goalieCards.map((c) => <LeaderCard key={c.title} title={c.title} rows={c.rows} managedTeamIds={managedTeamIds} />)}
        </div>
      </section>

      <div className="space-y-1">
        <p className="text-xs text-slate-600">Penalty-shot goals and penalty-shot % are not tracked by the sim engine yet.</p>
        <p className="text-xs text-slate-600"><Link href={`/stats/players${league === "AHL" ? "?league=AHL" : ""}`} className="hover:text-blue-400">Full player stats →</Link></p>
      </div>
    </div>
  );
}
