import Link from "next/link";
import { skaterTotals, skaterSituationTotals } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import PhaseTabs from "@/components/PhaseTabs";
import { seasonForPhase } from "@/lib/phase";
import { defaultStatsPhase } from "@/lib/calendar-server";
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

const SITUATION_COLS: Col[] = [
  { key: "name", label: "Player", title: "Player Name", frozen: true, link: true },
  { key: "teamCode", label: "Team", title: "Team", team: true },
  { key: "number", label: "#", title: "Jersey Number", num: true, format: "jersey" },
  { key: "position", label: "POS", title: "Position" },
  { key: "gp", label: "GP", title: "Games with time in this situation", num: true },
  { key: "goals", label: "G", title: "Goals", num: true },
  { key: "assists", label: "A", title: "Assists", num: true },
  { key: "points", label: "P", title: "Points", num: true },
  { key: "plusMinus", label: "+/-", title: "Plus / Minus (used for 5-on-5)", num: true, format: "plusMinus" },
  { key: "shots", label: "SHT", title: "Shots", num: true },
  { key: "shtPct", label: "SHT%", title: "Shooting %", num: true, format: "dec1" },
  { key: "xg", label: "xG", title: "Individual Expected Goals", num: true, format: "dec1" },
  { key: "gax", label: "G-xG", title: "Goals Above Expected", num: true, format: "plusDec1" },
  { key: "toi", label: "TOI", title: "Time on Ice in this situation", num: true, format: "minutesClock" },
  { key: "mp", label: "TOI/GP", title: "Average situation TOI per Game", num: true, format: "minutesClock" },
  { key: "p60", label: "P/60", title: "Points per 60 situation minutes", num: true, format: "dec2" },
];

const SITUATIONS = [
  ["all", "All"], ["5v5", "5 vs 5"], ["4v4", "4 vs 4"], ["3v3", "3 vs 3"],
  ["pp", "Power Play"], ["pk", "Penalty Kill"], ["en-own", "Own Net Empty"], ["en-opp", "Against Empty Net"],
] as const;
const DB_SITUATION: Record<string, string> = { "5v5": "5V5", "4v4": "4V4", "3v3": "3V3", pp: "PP", pk: "PK", "en-own": "EN_OWN", "en-opp": "EN_OPP" };

export default async function PlayerStatsPage({ searchParams }: { searchParams: Promise<{ league?: string; phase?: string; situation?: string }> }) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  // Explicit ?phase= always wins (lets a visitor look at either view manually);
  // otherwise default to whatever the live league clock says right now — the page
  // auto-shows pre-season stats for the duration of the pre-season phase.
  const explicit = sp.phase === "pre" || sp.phase === "regular" ? sp.phase : null;
  const auto = league === "NHL" ? await defaultStatsPhase() : "regular";
  const phase: "pre" | "regular" = league !== "NHL" ? "regular" : explicit ?? (auto === "playoffs" ? "regular" : auto);
  const SEASON = seasonForPhase(phase);
  const situation = DB_SITUATION[sp.situation ?? ""] ? sp.situation! : "all";
  const sk = situation === "all"
    ? await skaterTotals(SEASON, league)
    : await skaterSituationTotals(SEASON, league, DB_SITUATION[situation]);
  const rows = sk.map((s) => ({
    _pid: s.playerId, name: s.name, teamCode: s.teamCode ?? "—", _teamSlug: s.teamSlug ?? "", _teamLogo: s.teamLogo ?? "", number: s.number ?? 0, position: s.position, gp: s.gp,
    goals: s.goals, assists: s.assists, points: s.points, plusMinus: "plusMinus5v5" in s ? Number(s.plusMinus5v5) : s.plusMinus,
    pim: "pim" in s ? Number(s.pim) : 0, hits: "hits" in s ? Number(s.hits) : 0, shots: s.shots,
    shtPct: s.shots ? (s.goals / s.shots) * 100 : 0,
    xg: s.xg,
    blocks: "blocks" in s ? Number(s.blocks) : 0, toi: s.toi / 60, mp: s.gp ? s.toi / s.gp / 60 : 0,
    ppGoals: "ppGoals" in s ? Number(s.ppGoals) : 0, ppa: "ppAssists" in s ? Number(s.ppAssists) : 0,
    ppp: "ppGoals" in s && "ppAssists" in s ? Number(s.ppGoals) + Number(s.ppAssists) : 0,
    shGoals: "shGoals" in s ? Number(s.shGoals) : 0, pka: "shAssists" in s ? Number(s.shAssists) : 0,
    pkp: "shGoals" in s && "shAssists" in s ? Number(s.shGoals) + Number(s.shAssists) : 0,
    p60: s.toi ? (s.points * 3600) / s.toi : 0,
    gax: s.goals - s.xg,
  }));
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle={`All skaters — ${league} ${phase === "pre" ? "pre-season (exhibition)" : "regular season"}`} />
      <StatsTabs active="players" league={league} />
      <PhaseTabs active={phase} league={league} basePath="/stats/players" showPlayoffs={false} />
      <div className="flex flex-wrap gap-2" aria-label="Game situation">
        {SITUATIONS.map(([key, label]) => {
          const qs = new URLSearchParams();
          if (league === "AHL") qs.set("league", "AHL");
          qs.set("phase", phase);
          if (key !== "all") qs.set("situation", key);
          return <Link key={key} href={`/stats/players?${qs.toString()}`} className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${situation === key ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white"}`}>{label}</Link>;
        })}
      </div>
      <p className="text-slate-400 text-sm">Click a header to sort; use Show / Hide Columns to customize.{phase === "pre" ? " Pre-season stats don't count toward profiles/careers." : ""}</p>
      {situation !== "all" && rows.length === 0 && <p className="text-xs text-amber-400/90">Exact situation tracking starts with games simulated after this feature was deployed; older games are not estimated.</p>}
      <StatTable cols={situation === "all" ? COLS : SITUATION_COLS} rows={rows} initialSort="points" minWidth={situation === "all" ? 1250 : 1050} />
    </div>
  );
}
