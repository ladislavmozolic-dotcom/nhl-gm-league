import { skaterTotals } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import PhaseTabs from "@/components/PhaseTabs";
import { seasonForPhase } from "@/lib/phase";
import StatTable, { type Col } from "@/components/StatTable";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const COLS: Col[] = [
  { key: "name", label: "Player", title: "Player Name", frozen: true, link: true },
  { key: "teamCode", label: "Team", title: "Team", team: true },
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
  { key: "mp", label: "MP", title: "Minutes Per Game (avg TOI)", num: true, format: "dec2" },
  { key: "ppGoals", label: "PPG", title: "Power-Play Goals", num: true },
  { key: "ppa", label: "PPA", title: "Power-Play Assists", num: true },
  { key: "ppp", label: "PPP", title: "Power-Play Points (PPG + PPA)", num: true },
  { key: "shGoals", label: "PKG", title: "Short-Handed Goals", num: true },
  { key: "pka", label: "PKA", title: "Short-Handed Assists", num: true },
  { key: "pkp", label: "PKP", title: "Short-Handed Points (PKG + PKA)", num: true },
  { key: "p20", label: "P/20", title: "Points per 20 min", num: true, format: "dec2" },
];

export default async function PlayerStatsPage({ searchParams }: { searchParams: Promise<{ league?: string; phase?: string }> }) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const phase: "pre" | "regular" = sp.phase === "pre" && league === "NHL" ? "pre" : "regular";
  const SEASON = seasonForPhase(phase);
  const sk = await skaterTotals(SEASON, league);
  const rows = sk.map((s) => ({
    _pid: s.playerId, name: s.name, teamCode: s.teamCode ?? "—", _teamSlug: s.teamSlug ?? "", _teamLogo: s.teamLogo ?? "", number: s.number ?? 0, position: s.position, gp: s.gp,
    goals: s.goals, assists: s.assists, points: s.points, plusMinus: s.plusMinus,
    pim: s.pim, hits: s.hits, shots: s.shots,
    shtPct: s.shots ? (s.goals / s.shots) * 100 : 0,
    blocks: s.blocks, mp: s.gp ? s.toi / s.gp / 60 : 0,
    ppGoals: s.ppGoals, ppa: s.ppAssists, ppp: s.ppGoals + s.ppAssists, shGoals: s.shGoals, pka: s.shAssists, pkp: s.shGoals + s.shAssists,
    p20: s.toi ? (s.points * 1200) / s.toi : 0,
  }));
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle={`All skaters — ${league} ${phase === "pre" ? "pre-season (exhibition)" : "regular season"}`} />
      <StatsTabs active="players" league={league} />
      <PhaseTabs active={phase} league={league} basePath="/stats/players" showPlayoffs={false} />
      <p className="text-slate-400 text-sm">Click a header to sort; use Show / Hide Columns to customize.{phase === "pre" ? " Pre-season stats don't count toward profiles/careers." : ""}</p>
      <StatTable cols={COLS} rows={rows} initialSort="points" minWidth={1180} />
    </div>
  );
}
