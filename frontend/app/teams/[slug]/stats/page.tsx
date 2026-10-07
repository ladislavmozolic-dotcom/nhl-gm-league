import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { skaterTotals, goalieTotals } from "@/lib/stats-server";
import StatTable, { type Col } from "@/components/StatTable";
import { Card, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

const SKATER_COLS: Col[] = [
  { key: "name", label: "Player", title: "Player Name", frozen: true, link: true },
  { key: "number", label: "#", title: "Jersey Number", num: true, format: "jersey" },
  { key: "position", label: "POS", title: "Position" },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "goals", label: "G", title: "Goals", num: true },
  { key: "assists", label: "A", title: "Assists", num: true },
  { key: "points", label: "P", title: "Points", num: true },
  { key: "plusMinus", label: "+/- 5v5", title: "Plus / Minus at 5-on-5", num: true, format: "plusMinus" },
  { key: "pim", label: "PIM", title: "Penalty Minutes", num: true },
  { key: "hits", label: "HIT", title: "Hits", num: true },
  { key: "shots", label: "SHT", title: "Shots", num: true },
  { key: "shtPct", label: "SHT%", title: "Shooting %", num: true, format: "dec1" },
  { key: "xg", label: "xG", title: "Individual Expected Goals", num: true, format: "dec1" },
  { key: "blocks", label: "SB", title: "Shots Blocked", num: true },
  { key: "toi", label: "TOI", title: "Total Time on Ice", num: true, format: "minutesClock" },
  { key: "mp", label: "TOI/GP", title: "Average Time on Ice per Game", num: true, format: "minutesClock" },
  { key: "ppGoals", label: "PPG", title: "Power-Play Goals", num: true },
  { key: "ppa", label: "PPA", title: "Power-Play Assists", num: true },
  { key: "ppp", label: "PPP", title: "Power-Play Points (PPG + PPA)", num: true },
  { key: "shGoals", label: "PKG", title: "Short-Handed Goals", num: true },
  { key: "pka", label: "PKA", title: "Short-Handed Assists", num: true },
  { key: "pkp", label: "PKP", title: "Short-Handed Points (PKG + PKA)", num: true },
  { key: "p60", label: "P/60", title: "Points per 60 minutes", num: true, format: "dec2" },
  { key: "gax", label: "G-xG", title: "Goals Above Expected (goals minus individual expected goals)", info: "Positive means the player converted more goals than an average finisher would be expected to score from the same chances.", num: true, format: "plusDec1" },
];

const GOALIE_COLS: Col[] = [
  { key: "name", label: "Goalie", title: "Goalie Name", frozen: true, link: true },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "wins", label: "W", title: "Wins", num: true },
  { key: "losses", label: "L", title: "Losses", num: true },
  { key: "otl", label: "OTL", title: "Overtime Losses", num: true },
  { key: "svPct", label: "PCT", title: "Save Percentage", num: true, format: "pct3" },
  { key: "gaa", label: "GAA", title: "Goals-Against Average", num: true, format: "dec2" },
  { key: "gsax", label: "GSAx", title: "Goals Saved Above Expected (xGA − GA)", num: true, format: "plusDec1", info: "Goals Saved Above Expected (xGA − GA)." },
  { key: "steals", label: "STL", title: "Steals (Ukradnuté zápasy)", num: true, info: "Ukradnuté zápasy (Steals): Zápasy s výhrou, kde brankárov GSAx prevýšil gólový náskok tímu (bez gólov do prázdnej brány)." },
  { key: "mp", label: "MP", title: "Minutes Played", num: true },
  { key: "shutouts", label: "SO", title: "Shutouts", num: true },
  { key: "goalsAgainst", label: "GA", title: "Goals Against", num: true },
  { key: "shotsAgainst", label: "SA", title: "Shots Against", num: true },
  { key: "saves", label: "SV", title: "Saves", num: true },
  { key: "xga", label: "xGA", title: "Expected Goals Against", num: true, format: "dec1", defaultHidden: true },
  { key: "pim", label: "PIM", title: "Penalty Minutes (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "a", label: "A", title: "Assists (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "eg", label: "EG", title: "Empty-Net Goals Against (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "psPct", label: "PS %", title: "Penalty-Shot Save % (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "psa", label: "PSA", title: "Penalty Shots Against (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "st", label: "ST", title: "Shootout attempts (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "bg", label: "BG", title: "Shootout goals against (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "s1", label: "S1", title: "Shootout round 1 (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "s2", label: "S2", title: "Shootout round 2 (not tracked)", num: true, format: "dash", defaultHidden: true },
  { key: "s3", label: "S3", title: "Shootout round 3 (not tracked)", num: true, format: "dash", defaultHidden: true },
];

export default async function TeamStatsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  const [allSk, allGk] = await Promise.all([
    skaterTotals(SEASON, team.league),
    goalieTotals(SEASON, team.league),
  ]);

  const sk = allSk.filter((r) => r.teamId === team.id);
  const gk = allGk.filter((r) => r.teamId === team.id);

  const skaterRows = sk.map((s) => ({
    _pid: s.playerId, name: s.name, number: s.number ?? 0, position: s.position, gp: s.gp,
    goals: s.goals, assists: s.assists, points: s.points, plusMinus: s.plusMinus5v5 ?? s.plusMinus,
    pim: s.pim, hits: s.hits, shots: s.shots,
    shtPct: s.shots ? (s.goals / s.shots) * 100 : 0,
    xg: s.xg,
    blocks: s.blocks, toi: s.toi / 60, mp: s.gp ? s.toi / s.gp / 60 : 0,
    ppGoals: s.ppGoals, ppa: s.ppAssists, ppp: s.ppGoals + s.ppAssists,
    shGoals: s.shGoals, pka: s.shAssists, pkp: s.shGoals + s.shAssists,
    p60: s.toi ? (s.points * 3600) / s.toi : 0,
    gax: s.goals - s.xg,
  }));

  const goalieRows = gk.map((g) => ({
    _pid: g.playerId, name: g.name, gp: g.gp, wins: g.wins, losses: g.losses, otl: g.otl,
    svPct: g.svPct, gaa: g.gaa, gsax: g.gsax, steals: g.steals, mp: g.toiMin, pim: 0, shutouts: g.shutouts,
    goalsAgainst: g.goalsAgainst, shotsAgainst: g.shotsAgainst, saves: g.saves, xga: g.xga,
    a: 0, eg: 0, psPct: 0, psa: 0, st: 0, bg: 0, s1: 0, s2: 0, s3: 0,
  }));

  const hasData = skaterRows.length > 0 || goalieRows.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <Card title="Player Stats" accent="text-blue-400">
          <p className="text-slate-500 text-center py-8">No statistics yet this season.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle count={skaterRows.length} accent="text-blue-400">Skaters</SectionTitle>
        <StatTable cols={SKATER_COLS} rows={skaterRows} initialSort="points" showRank minWidth={1250} tieBreaks={{ points: ["goals", "-gp"] }} />
      </div>

      <div>
        <SectionTitle count={goalieRows.length} accent="text-blue-400">Goalies</SectionTitle>
        <StatTable cols={GOALIE_COLS} rows={goalieRows} initialSort="wins" minWidth={1160} />
        <p className="text-xs text-slate-600 mt-2">Columns showing “—” (PIM, A, EG, PS %, PSA, ST, BG, S1–S3) are stat fields the sim engine doesn’t record yet — hide them with Show / Hide Columns, or ask to add shootout &amp; penalty-shot tracking.</p>
      </div>
    </div>
  );
}
