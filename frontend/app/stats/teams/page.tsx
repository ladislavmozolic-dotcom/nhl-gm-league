import { teamStatTotals } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import StatTable, { type Col } from "@/components/StatTable";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

// Base columns (shown by default) mirror the old Team Stats view; the rest are
// available through the Show / Hide Columns filter.
const COLS: Col[] = [
  { key: "name", label: "Team", title: "Team", frozen: true, team: true },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "w", label: "W", title: "Wins", num: true },
  { key: "l", label: "L", title: "Losses", num: true },
  { key: "otl", label: "OTL", title: "Overtime / Shootout Losses", num: true },
  { key: "points", label: "PTS", title: "Points", num: true },
  { key: "gf", label: "GF", title: "Goals For", num: true },
  { key: "ga", label: "GA", title: "Goals Against", num: true },
  { key: "diff", label: "DIFF", title: "Goal Differential", num: true, format: "plusMinus" },
  { key: "gfPerGame", label: "GF/G", title: "Goals For per Game", num: true, format: "dec2" },
  { key: "gaPerGame", label: "GA/G", title: "Goals Against per Game", num: true, format: "dec2" },
  // extras — hidden until enabled in the filter
  { key: "rw", label: "RW", title: "Regulation Wins", num: true, defaultHidden: true },
  { key: "otw", label: "OTW", title: "Overtime Wins", num: true, defaultHidden: true },
  { key: "sow", label: "SOW", title: "Shootout Wins", num: true, defaultHidden: true },
  { key: "sol", label: "SOL", title: "Shootout Losses", num: true, defaultHidden: true },
  { key: "pct", label: "PCT", title: "Points Percentage", num: true, format: "pct3", defaultHidden: true },
  { key: "shotsFor", label: "SHF", title: "Shots For", num: true, defaultHidden: true },
  { key: "shotsAgainst", label: "SHA", title: "Shots Against", num: true, defaultHidden: true },
  { key: "sfPerGame", label: "SF/G", title: "Shots For per Game", num: true, format: "dec1", defaultHidden: true },
  { key: "saPerGame", label: "SA/G", title: "Shots Against per Game", num: true, format: "dec1", defaultHidden: true },
  { key: "shutouts", label: "SO", title: "Shutouts", num: true, defaultHidden: true },
  { key: "goals", label: "G", title: "Total Team Goals", num: true, defaultHidden: true },
  { key: "assists", label: "A", title: "Total Team Assists", num: true, defaultHidden: true },
  { key: "pim", label: "PIM", title: "Penalty Minutes", num: true, defaultHidden: true },
  { key: "hits", label: "HIT", title: "Hits", num: true, defaultHidden: true },
  { key: "blocks", label: "SHB", title: "Shots Blocked", num: true, defaultHidden: true },
  { key: "ppGoals", label: "PPG", title: "Power-Play Goals", num: true, defaultHidden: true },
  { key: "shGoals", label: "SHG", title: "Short-Handed Goals", num: true, defaultHidden: true },
];

export default async function TeamStatsPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const league = (await searchParams).league === "AHL" ? "AHL" : "NHL";
  const teams = await teamStatTotals(SEASON, league);
  const rows = teams.map((t) => ({
    name: t.name, _teamSlug: t.slug ?? "", _teamLogo: t.logoUrl ?? "", gp: t.gp, w: t.w, l: t.l, otl: t.otl, points: t.points,
    gf: t.gf, ga: t.ga, diff: t.diff, gfPerGame: t.gfPerGame, gaPerGame: t.gaPerGame,
    rw: t.rw, otw: t.otw, sow: t.sow, sol: t.sol, pct: t.pct,
    shotsFor: t.shotsFor, shotsAgainst: t.shotsAgainst, sfPerGame: t.sfPerGame, saPerGame: t.saPerGame,
    shutouts: t.shutouts, goals: t.goals, assists: t.assists, pim: t.pim, hits: t.hits, blocks: t.blocks,
    ppGoals: t.ppGoals, shGoals: t.shGoals,
  }));
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle={`Team totals — ${league} ${SEASON} regular season`} />
      <StatsTabs active="teams" league={league} />
      <p className="text-slate-400 text-sm">Click a header to sort; use Show / Hide Columns to add more stats.</p>
      <StatTable cols={COLS} rows={rows} initialSort="points" minWidth={760} />
      <p className="text-xs text-slate-600">More columns (shots, shutouts, team totals, special-teams goals) are available in Show / Hide Columns. PP% / PK% need power-play opportunity tracking, added when the sim engine is extended.</p>
    </div>
  );
}
