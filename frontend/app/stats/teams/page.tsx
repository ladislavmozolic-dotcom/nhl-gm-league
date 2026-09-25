import { teamStatTotals } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import StatTable, { type Col } from "@/components/StatTable";
import { PageHeader } from "@/components/ui";
import PhaseTabs from "@/components/PhaseTabs";
import { seasonForPhase } from "@/lib/phase";
import { defaultStatsPhase } from "@/lib/calendar-server";

export const dynamic = "force-dynamic";

// Base columns (shown by default) mirror the old Team Stats view; the rest are
// available through the Show / Hide Columns filter.
const COLS: Col[] = [
  { key: "name", label: "Team", title: "Team", frozen: true, team: true },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "w", label: "W", title: "Wins", num: true },
  { key: "l", label: "L", title: "Losses", num: true },
  { key: "otl", label: "OTL", title: "Overtime / Shootout Losses", num: true },
  { key: "points", label: "PTS", title: "Points", num: true },
  { key: "rw", label: "RW", title: "Regulation Wins", num: true },
  { key: "row", label: "ROW", title: "Regulation + Overtime Wins", num: true },
  { key: "so", label: "SO", title: "Shootout Record (W-L)" },
  { key: "gf", label: "GF", title: "Goals For", num: true },
  { key: "ga", label: "GA", title: "Goals Against", num: true },
  { key: "diff", label: "DIFF", title: "Goal Differential", num: true, format: "plusMinus" },
  { key: "gfPerGame", label: "GF/G", title: "Goals For per Game", num: true, format: "dec2" },
  { key: "gaPerGame", label: "GA/G", title: "Goals Against per Game", num: true, format: "dec2" },
  { key: "xgf60", label: "xGF/60", title: "Expected Goals For per 60 minutes at 5-on-5", num: true, format: "dec2" },
  { key: "xga60", label: "xGA/60", title: "Expected Goals Against per 60 minutes at 5-on-5", num: true, format: "dec2" },
  { key: "xgfPct", label: "xGF%", title: "Share of expected goals at 5-on-5", num: true, format: "pct1" },
  { key: "ppPct", label: "PP%", title: "Power-play %", info: "Power-play goals ÷ power-play opportunities. An opportunity is every time the club goes up a man (a 5-on-3 that follows a 5-on-4 is the same opportunity).", num: true, format: "pct1" },
  { key: "pkPct", label: "PK%", title: "Penalty-kill %", info: "Share of the opponents' power plays killed without conceding a PP goal.", num: true, format: "pct1" },
  { key: "pdo", label: "PDO", title: "5-on-5 shooting % + save % (×100)", info: "PDO — 5-on-5 shooting % plus 5-on-5 save %. League average is always ~100; well above = riding hot finishing/goaltending (tends to regress), well below = unlucky.", num: true, format: "dec1" },
  { key: "hdcfPct", label: "HDCF%", title: "High-danger chance share (slot / net-front shots on goal, all strengths)", info: "High-Danger Chances For % — your share of all slot and net-front shots on goal in your games.", num: true, format: "pct1" },
  // extras — hidden until enabled in the filter
  { key: "otw", label: "OTW", title: "Overtime Wins", num: true, defaultHidden: true },
  { key: "sow", label: "SOW", title: "Shootout Wins", num: true, defaultHidden: true },
  { key: "sol", label: "SOL", title: "Shootout Losses", num: true, defaultHidden: true },
  { key: "pct", label: "PCT", title: "Points Percentage", num: true, format: "pct3", defaultHidden: true },
  { key: "shotsFor", label: "SHF", title: "Shots For", num: true, defaultHidden: true },
  { key: "shotsAgainst", label: "SHA", title: "Shots Against", num: true, defaultHidden: true },
  { key: "sfPerGame", label: "SF/G", title: "Shots For per Game", num: true, format: "dec1", defaultHidden: true },
  { key: "saPerGame", label: "SA/G", title: "Shots Against per Game", num: true, format: "dec1", defaultHidden: true },
  { key: "shutouts", label: "SHO", title: "Shutouts", num: true, defaultHidden: true },
  { key: "goals", label: "G", title: "Total Team Goals", num: true, defaultHidden: true },
  { key: "assists", label: "A", title: "Total Team Assists", num: true, defaultHidden: true },
  { key: "pim", label: "PIM", title: "Penalty Minutes", num: true, defaultHidden: true },
  { key: "hits", label: "HIT", title: "Hits", num: true, defaultHidden: true },
  { key: "blocks", label: "SHB", title: "Shots Blocked", num: true, defaultHidden: true },
  { key: "ppGoals", label: "PPG", title: "Power-Play Goals", num: true, defaultHidden: true },
  { key: "shGoals", label: "SHG", title: "Short-Handed Goals", num: true, defaultHidden: true },
  { key: "ppOpp", label: "PPO", title: "Power-play opportunities", num: true, defaultHidden: true },
  { key: "ppGoalsFor", label: "PPGF", title: "Power-play goals for (event stream)", num: true, defaultHidden: true },
  { key: "timesSh", label: "TSH", title: "Times short-handed", num: true, defaultHidden: true },
  { key: "ppGoalsAgainst", label: "PPGA", title: "Power-play goals against", num: true, defaultHidden: true },
  { key: "evShPct", label: "5v5 SH%", title: "5-on-5 shooting %", num: true, format: "pct1", defaultHidden: true },
  { key: "evSvPct", label: "5v5 SV%", title: "5-on-5 save %", num: true, format: "pct3", defaultHidden: true },
  { key: "hdcf", label: "HDCF", title: "High-danger shots on goal for", num: true, defaultHidden: true },
  { key: "hdca", label: "HDCA", title: "High-danger shots on goal against", num: true, defaultHidden: true },
  { key: "hdGoalsFor", label: "HDGF", title: "High-danger goals for", num: true, defaultHidden: true },
];

export default async function TeamStatsPage({ searchParams }: { searchParams: Promise<{ league?: string; phase?: string }> }) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  // same rule as Player Stats: explicit ?phase= wins, else follow the league clock
  const explicit = sp.phase === "pre" || sp.phase === "regular" ? sp.phase : null;
  const auto = league === "NHL" ? await defaultStatsPhase() : "regular";
  const phase: "pre" | "regular" = league !== "NHL" ? "regular" : explicit ?? (auto === "playoffs" ? "regular" : auto);
  const SEASON = seasonForPhase(phase);
  const teams = await teamStatTotals(SEASON, league);
  const rows = teams.map((t) => ({
    name: t.name, _teamSlug: t.slug ?? "", _teamLogo: t.logoUrl ?? "", gp: t.gp, w: t.w, l: t.l, otl: t.otl, points: t.points,
    gf: t.gf, ga: t.ga, diff: t.diff, gfPerGame: t.gfPerGame, gaPerGame: t.gaPerGame,
    rw: t.rw, row: t.row, otw: t.otw, sow: t.sow, sol: t.sol, so: `${t.sow}-${t.sol}`, pct: t.pct,
    shotsFor: t.shotsFor, shotsAgainst: t.shotsAgainst, sfPerGame: t.sfPerGame, saPerGame: t.saPerGame,
    shutouts: t.shutouts, goals: t.goals, assists: t.assists, pim: t.pim, hits: t.hits, blocks: t.blocks,
    ppGoals: t.ppGoals, shGoals: t.shGoals,
    xgf60: t.xgf60, xga60: t.xga60, xgfPct: t.xgfPct,
    ppPct: t.ppPct, pkPct: t.pkPct, pdo: t.pdo, hdcfPct: t.hdcfPct,
    ppOpp: t.ppOpp, ppGoalsFor: t.ppGoalsFor, timesSh: t.timesSh, ppGoalsAgainst: t.ppGoalsAgainst,
    evShPct: t.evShPct, evSvPct: t.evSvPct, hdcf: t.hdcf, hdca: t.hdca, hdGoalsFor: t.hdGoalsFor,
  }));
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle={`Team totals — ${league} 2026-27 ${phase === "pre" ? "pre-season (exhibition)" : "regular season"}`} />
      <StatsTabs active="teams" league={league} />
      <PhaseTabs active={phase} league={league} basePath="/stats/teams" showPlayoffs={false} />
      <p className="text-slate-400 text-sm">Click a header to sort; use Show / Hide Columns to add more stats.</p>
      <StatTable cols={COLS} rows={rows} initialSort="points" minWidth={1000} />
      <p className="text-xs text-slate-600">More columns (PP opportunities, times short-handed, 5-on-5 SH%/SV%, raw high-danger counts, shots, shutouts) are available in Show / Hide Columns. Special-teams and high-danger numbers come from the sim&apos;s event stream.</p>
    </div>
  );
}
