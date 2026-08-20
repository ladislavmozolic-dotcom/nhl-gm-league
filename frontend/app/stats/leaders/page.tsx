import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PlayerLink from "@/components/PlayerLink";
import { skaterTotals, goalieTotals, type SkaterTotal, type GoalieTotal } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import { Card, PageHeader, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

type Row = { playerId: number; name: string; teamCode: string | null; teamSlug: string | null; value: string; sub?: string };

function LeaderCard({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <Card title={title} bodyClassName="p-0">
      <div className="divide-y divide-slate-800/60">
        {rows.length === 0 && <div className="px-4 py-4 text-slate-600 text-sm">no data</div>}
        {rows.map((r, i) => (
          <div key={r.playerId} className="flex items-center gap-2 px-4 py-1.5 text-sm hover:bg-slate-800/30 transition-colors">
            <span className={`w-5 text-right tabular-nums ${i === 0 ? "text-amber-400 font-bold" : "text-slate-500"}`}>{i + 1}</span>
            <span className="flex-1 truncate">
              <PlayerLink id={r.playerId} name={r.name} clean={false} />
              {r.teamCode && <span className="text-slate-500 text-xs ml-1.5">{r.teamCode}</span>}
            </span>
            {r.sub && <span className="tabular-nums text-[10px] text-slate-500 shrink-0">{r.sub}</span>}
            <span className="tabular-nums font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const top = <T,>(arr: T[], key: (t: T) => number, n = 10) => [...arr].sort((a, b) => key(b) - key(a)).slice(0, n);
const skRow = (s: SkaterTotal, value: string, sub?: string): Row => ({ playerId: s.playerId, name: s.name, teamCode: s.teamCode, teamSlug: s.teamSlug, value, sub });
const gkRow = (g: GoalieTotal, value: string, sub?: string): Row => ({ playerId: g.playerId, name: g.name, teamCode: g.teamCode, teamSlug: g.teamSlug, value, sub });

export default async function LeadersPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const league = (await searchParams).league === "AHL" ? "AHL" : "NHL";
  const [sk, gk, finals] = await Promise.all([
    skaterTotals(SEASON, league),
    goalieTotals(SEASON, league),
    prisma.game.findMany({ where: { season: SEASON, league, status: "FINAL" }, select: { homeTeamId: true, awayTeamId: true } }),
  ]);
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
    { title: "Plus / Minus", rows: top(sk, (s) => s.plusMinus).map((s) => skRow(s, (s.plusMinus > 0 ? "+" : "") + s.plusMinus, `${s.gp} GP`)) },
    { title: "Minutes Played", rows: top(sk, (s) => s.toi).map((s) => skRow(s, String(mins(s.toi)), `${s.gp} GP`)) },
    { title: "Penalty Minutes", rows: top(sk, (s) => s.pim).map((s) => skRow(s, String(s.pim), `${s.gp} GP`)) },
    { title: "Shots", rows: top(sk, (s) => s.shots).map((s) => skRow(s, String(s.shots), `${s.gp} GP`)) },
    { title: "Power-Play Goals", rows: top(sk, (s) => s.ppGoals).map((s) => skRow(s, String(s.ppGoals), `${s.gp} GP`)) },
    { title: "Short-Handed Goals", rows: top(sk, (s) => s.shGoals).map((s) => skRow(s, String(s.shGoals), `${s.gp} GP`)) },
    { title: "Game-Winning Goals", rows: top(sk, (s) => s.gwg).map((s) => skRow(s, String(s.gwg), `${s.gp} GP`)) },
    { title: "Hits", rows: top(sk, (s) => s.hits).map((s) => skRow(s, String(s.hits), `${s.gp} GP`)) },
    { title: "Shots Blocked", rows: top(sk, (s) => s.blocks).map((s) => skRow(s, String(s.blocks), `${s.gp} GP`)) },
  ];

  // Rate stats (SV%, GAA) need a sample that scales with season progress, so a hot
  // 2-3 game backup doesn't top the leaderboard at mid-season. The required share of
  // a goalie's OWN team games ramps linearly: ~10% at the half (42 GP → 4+ GP), ~20%
  // at a full 84-game season (→ 17 GP). Early on (<10 team games) the gate is ~1, so
  // we still see everyone. minGP = 0.20 · teamGP² / FULL.
  const FULL = 84;
  const gkMinFor = (tid: number | null) => {
    const tg = (tid != null ? teamGP.get(tid) : 0) ?? 0;
    return Math.max(1, Math.round((0.2 * tg * tg) / FULL));
  };
  const qualGk = gk.filter((g) => g.gp >= gkMinFor(g.teamId));
  const maxTeamGP = Math.max(0, ...teamGP.values());
  const repMin = Math.max(1, Math.round((0.2 * maxTeamGP * maxTeamGP) / FULL));
  const repPct = maxTeamGP ? Math.round((repMin / maxTeamGP) * 100) : 0;
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

      <section>
        <SectionTitle accent="text-blue-400">Skater Leaders — {league} {SEASON}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skaterCards.map((c) => <LeaderCard key={c.title} title={c.title} rows={c.rows} />)}
        </div>
      </section>

      <section>
        <SectionTitle accent="text-red-400">Goalie Leaders — SV%/GAA need ~{repPct}% of team games ({repMin}+ GP) as the season matures</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goalieCards.map((c) => <LeaderCard key={c.title} title={c.title} rows={c.rows} />)}
        </div>
      </section>

      <div className="space-y-1">
        <p className="text-xs text-slate-600">Penalty-shot goals and penalty-shot % are not tracked by the sim engine yet.</p>
        <p className="text-xs text-slate-600"><Link href={`/stats/players${league === "AHL" ? "?league=AHL" : ""}`} className="hover:text-blue-400">Full player stats →</Link></p>
      </div>
    </div>
  );
}
