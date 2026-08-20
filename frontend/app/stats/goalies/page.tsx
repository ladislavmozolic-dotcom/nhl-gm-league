import { goalieTotals } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import StatTable, { type Col } from "@/components/StatTable";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

const COLS: Col[] = [
  { key: "name", label: "Goalie", title: "Goalie Name", frozen: true, link: true },
  { key: "teamCode", label: "Team", title: "Team", team: true },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "wins", label: "W", title: "Wins", num: true },
  { key: "losses", label: "L", title: "Losses", num: true },
  { key: "otl", label: "OTL", title: "Overtime Losses", num: true },
  { key: "svPct", label: "PCT", title: "Save Percentage", num: true, format: "pct3" },
  { key: "gaa", label: "GAA", title: "Goals-Against Average", num: true, format: "dec2" },
  { key: "mp", label: "MP", title: "Minutes Played", num: true },
  { key: "pim", label: "PIM", title: "Penalty Minutes (not tracked)", num: true, format: "dash" },
  { key: "shutouts", label: "SO", title: "Shutouts", num: true },
  { key: "goalsAgainst", label: "GA", title: "Goals Against", num: true },
  { key: "shotsAgainst", label: "SA", title: "Shots Against", num: true },
  { key: "saves", label: "SAR", title: "Saves", num: true },
  { key: "a", label: "A", title: "Assists (not tracked)", num: true, format: "dash" },
  { key: "eg", label: "EG", title: "Empty-Net Goals Against (not tracked)", num: true, format: "dash" },
  { key: "psPct", label: "PS %", title: "Penalty-Shot Save % (not tracked)", num: true, format: "dash" },
  { key: "psa", label: "PSA", title: "Penalty Shots Against (not tracked)", num: true, format: "dash" },
  { key: "st", label: "ST", title: "Shootout attempts (not tracked)", num: true, format: "dash" },
  { key: "bg", label: "BG", title: "Shootout goals against (not tracked)", num: true, format: "dash" },
  { key: "s1", label: "S1", title: "Shootout round 1 (not tracked)", num: true, format: "dash" },
  { key: "s2", label: "S2", title: "Shootout round 2 (not tracked)", num: true, format: "dash" },
  { key: "s3", label: "S3", title: "Shootout round 3 (not tracked)", num: true, format: "dash" },
];

export default async function GoalieStatsPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const league = (await searchParams).league === "AHL" ? "AHL" : "NHL";
  const gk = await goalieTotals(SEASON, league);
  const rows = gk.map((g) => ({
    _pid: g.playerId, name: g.name, teamCode: g.teamCode ?? "—", _teamSlug: g.teamSlug ?? "", _teamLogo: g.teamLogo ?? "", gp: g.gp, wins: g.wins, losses: g.losses, otl: g.otl,
    svPct: g.svPct, gaa: g.gaa, mp: g.toiMin, pim: 0, shutouts: g.shutouts,
    goalsAgainst: g.goalsAgainst, shotsAgainst: g.shotsAgainst, saves: g.saves,
    a: 0, eg: 0, psPct: 0, psa: 0, st: 0, bg: 0, s1: 0, s2: 0, s3: 0,
  }));
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle={`All goalies — ${league} ${SEASON} regular season`} />
      <StatsTabs active="goalies" league={league} />
      <p className="text-slate-400 text-sm">Click a header to sort; use Show / Hide Columns to customize.</p>
      <StatTable cols={COLS} rows={rows} initialSort="wins" minWidth={1160} />
      <p className="text-xs text-slate-600">Columns showing “—” (PIM, A, EG, PS %, PSA, ST, BG, S1–S3) are stat fields the sim engine doesn’t record yet — hide them with Show / Hide Columns, or ask to add shootout & penalty-shot tracking.</p>
    </div>
  );
}
