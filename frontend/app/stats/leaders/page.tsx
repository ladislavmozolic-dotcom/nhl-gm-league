import Link from "next/link";
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
            <span className="tabular-nums font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const top = <T,>(arr: T[], key: (t: T) => number, n = 10) => [...arr].sort((a, b) => key(b) - key(a)).slice(0, n);
const skRow = (s: SkaterTotal, value: string): Row => ({ playerId: s.playerId, name: s.name, teamCode: s.teamCode, teamSlug: s.teamSlug, value });
const gkRow = (g: GoalieTotal, value: string): Row => ({ playerId: g.playerId, name: g.name, teamCode: g.teamCode, teamSlug: g.teamSlug, value });

export default async function LeadersPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const league = (await searchParams).league === "AHL" ? "AHL" : "NHL";
  const [sk, gk] = await Promise.all([skaterTotals(SEASON, league), goalieTotals(SEASON, league)]);
  const mins = (toi: number) => Math.round(toi / 60);

  const skaterCards: Array<{ title: string; rows: Row[] }> = [
    { title: "Goals", rows: top(sk, (s) => s.goals).map((s) => skRow(s, String(s.goals))) },
    { title: "Assists", rows: top(sk, (s) => s.assists).map((s) => skRow(s, String(s.assists))) },
    { title: "Points", rows: top(sk, (s) => s.points).map((s) => skRow(s, String(s.points))) },
    { title: "Defensemen (points)", rows: top(sk.filter((s) => s.position.includes("D")), (s) => s.points).map((s) => skRow(s, String(s.points))) },
    { title: "Rookies (points)", rows: top(sk.filter((s) => s.rookie), (s) => s.points).map((s) => skRow(s, String(s.points))) },
    { title: "Plus / Minus", rows: top(sk, (s) => s.plusMinus).map((s) => skRow(s, (s.plusMinus > 0 ? "+" : "") + s.plusMinus)) },
    { title: "Minutes Played", rows: top(sk, (s) => s.toi).map((s) => skRow(s, String(mins(s.toi)))) },
    { title: "Penalty Minutes", rows: top(sk, (s) => s.pim).map((s) => skRow(s, String(s.pim))) },
    { title: "Shots", rows: top(sk, (s) => s.shots).map((s) => skRow(s, String(s.shots))) },
    { title: "Power-Play Goals", rows: top(sk, (s) => s.ppGoals).map((s) => skRow(s, String(s.ppGoals))) },
    { title: "Short-Handed Goals", rows: top(sk, (s) => s.shGoals).map((s) => skRow(s, String(s.shGoals))) },
    { title: "Game-Winning Goals", rows: top(sk, (s) => s.gwg).map((s) => skRow(s, String(s.gwg))) },
    { title: "Hits", rows: top(sk, (s) => s.hits).map((s) => skRow(s, String(s.hits))) },
    { title: "Shots Blocked", rows: top(sk, (s) => s.blocks).map((s) => skRow(s, String(s.blocks))) },
  ];

  // Rate stats (SV%, GAA) need a sample, but early in the season a flat 10-GP gate
  // hides everything. Scale the minimum with the league's busiest goalie so leaders
  // show from the first games and the bar tightens to 10 GP as the season matures.
  const maxGkGp = gk.reduce((m, g) => Math.max(m, g.gp), 0);
  const gkMin = Math.min(10, Math.max(1, Math.ceil(maxGkGp * 0.4)));
  const qualGk = gk.filter((g) => g.gp >= gkMin);
  const goalieCards: Array<{ title: string; rows: Row[] }> = [
    { title: "Wins", rows: top(gk, (g) => g.wins).map((g) => gkRow(g, String(g.wins))) },
    { title: "Save Percentage", rows: top(qualGk, (g) => g.svPct).map((g) => gkRow(g, g.svPct.toFixed(3).replace(/^0/, ""))) },
    { title: "Goals-Against Average", rows: top(qualGk, (g) => -g.gaa).map((g) => gkRow(g, g.gaa.toFixed(2))) },
    { title: "Minutes Played", rows: top(gk, (g) => g.toiMin).map((g) => gkRow(g, String(g.toiMin))) },
    { title: "Shutouts", rows: top(gk, (g) => g.shutouts).map((g) => gkRow(g, String(g.shutouts))) },
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
        <SectionTitle accent="text-red-400">Goalie Leaders — min. {gkMin} GP where noted</SectionTitle>
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
