import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { skaterTotals, goalieTotals } from "@/lib/stats-server";
import StatTable, { type Col } from "@/components/StatTable";
import { Card, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

const SKATER_COLS: Col[] = [
  { key: "name", label: "Player", title: "Player Name", frozen: true },
  { key: "number", label: "#", title: "Jersey Number", num: true, format: "jersey" },
  { key: "position", label: "POS", title: "Position" },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "goals", label: "G", title: "Goals", num: true },
  { key: "assists", label: "A", title: "Assists", num: true },
  { key: "points", label: "P", title: "Points", num: true },
  { key: "plusMinus", label: "+/-", title: "Plus / Minus", num: true, format: "plusMinus" },
  { key: "pim", label: "PIM", title: "Penalty Minutes", num: true },
  { key: "hits", label: "HIT", title: "Hits", num: true },
  { key: "shots", label: "SHT", title: "Shots", num: true },
  { key: "shtPct", label: "SHT%", title: "Shooting %", num: true, format: "dec1" },
  { key: "blocks", label: "SB", title: "Shots Blocked", num: true },
  { key: "mp", label: "MP", title: "Minutes Played", num: true },
  { key: "ppGoals", label: "PPG", title: "Power-Play Goals", num: true },
  { key: "ppa", label: "PPA", title: "Power-Play Assists (not tracked)", num: true, format: "dash" },
  { key: "ppp", label: "PPP", title: "Power-Play Points (not tracked)", num: true, format: "dash" },
  { key: "shGoals", label: "PKG", title: "Short-Handed Goals", num: true },
  { key: "pka", label: "PKA", title: "Short-Handed Assists (not tracked)", num: true, format: "dash" },
  { key: "pkp", label: "PKP", title: "Short-Handed Points (not tracked)", num: true, format: "dash" },
  { key: "p20", label: "P/20", title: "Points per 20 min", num: true, format: "dec2" },
];

const GOALIE_COLS: Col[] = [
  { key: "name", label: "Goalie", title: "Goalie Name", frozen: true },
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
    name: s.name, number: s.number ?? 0, position: s.position, gp: s.gp,
    goals: s.goals, assists: s.assists, points: s.points, plusMinus: s.plusMinus,
    pim: s.pim, hits: s.hits, shots: s.shots,
    shtPct: s.shots ? (s.goals / s.shots) * 100 : 0,
    blocks: s.blocks, mp: Math.round(s.toi / 60),
    ppGoals: s.ppGoals, ppa: 0, ppp: 0, shGoals: s.shGoals, pka: 0, pkp: 0,
    p20: s.toi ? (s.points * 1200) / s.toi : 0,
  }));

  const goalieRows = gk.map((g) => ({
    name: g.name, gp: g.gp, wins: g.wins, losses: g.losses, otl: g.otl,
    svPct: g.svPct, gaa: g.gaa, mp: g.toiMin, pim: 0, shutouts: g.shutouts,
    goalsAgainst: g.goalsAgainst, shotsAgainst: g.shotsAgainst, saves: g.saves,
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
        <StatTable cols={SKATER_COLS} rows={skaterRows} initialSort="points" minWidth={1080} />
        <p className="text-xs text-slate-600 mt-2">PPA / PPP / PKA / PKP show “—” because the sim engine tracks power-play &amp; short-handed <em>goals</em> but not yet the assists. Ask to enable per-strength assist tracking to fill these in.</p>
      </div>

      <div>
        <SectionTitle count={goalieRows.length} accent="text-blue-400">Goalies</SectionTitle>
        <StatTable cols={GOALIE_COLS} rows={goalieRows} initialSort="wins" minWidth={1060} />
        <p className="text-xs text-slate-600 mt-2">Columns showing “—” (PIM, A, EG, PS %, PSA, ST, BG, S1–S3) are stat fields the sim engine doesn’t record yet — hide them with Show / Hide Columns, or ask to add shootout &amp; penalty-shot tracking.</p>
      </div>
    </div>
  );
}
