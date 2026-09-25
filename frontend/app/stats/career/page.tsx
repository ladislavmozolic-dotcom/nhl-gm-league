import Link from "next/link";
import StatsTabs from "@/components/StatsTabs";
import StatTable, { type Col } from "@/components/StatTable";
import { PageHeader } from "@/components/ui";
import { careerLeaderboard } from "@/lib/career-server";

export const dynamic = "force-dynamic";

// League-wide career totals: every finished season from the frozen archive
// (PlayerSeasonStat / GoalieSeasonStat) + the active season live. Only games
// played in OUR league count — not a player's real-life NHL history.
const SKATER_COLS: Col[] = [
  { key: "name", label: "Player", title: "Player Name", frozen: true, link: true },
  { key: "teamCode", label: "Team", title: "Current team", team: true },
  { key: "pos", label: "Pos", title: "Position" },
  { key: "seasons", label: "Szn", title: "Seasons played in the league", num: true },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "goals", label: "G", title: "Goals", num: true },
  { key: "assists", label: "A", title: "Assists", num: true },
  { key: "points", label: "P", title: "Points", num: true },
  { key: "ppg", label: "P/GP", title: "Points per game", num: true, format: "dec2" },
  { key: "plusMinus", label: "+/-", title: "Plus / Minus", num: true, format: "plusMinus" },
  { key: "pim", label: "PIM", title: "Penalty Minutes", num: true },
  { key: "shots", label: "S", title: "Shots", num: true },
  { key: "ppGoals", label: "PPG", title: "Power-Play Goals", num: true, defaultHidden: true },
  { key: "shGoals", label: "SHG", title: "Short-Handed Goals", num: true, defaultHidden: true },
  { key: "gwg", label: "GWG", title: "Game-Winning Goals", num: true, defaultHidden: true },
  { key: "hits", label: "HIT", title: "Hits", num: true, defaultHidden: true },
  { key: "blocks", label: "BLK", title: "Blocked Shots", num: true, defaultHidden: true },
];

const GOALIE_COLS: Col[] = [
  { key: "name", label: "Goalie", title: "Goalie Name", frozen: true, link: true },
  { key: "teamCode", label: "Team", title: "Current team", team: true },
  { key: "seasons", label: "Szn", title: "Seasons played in the league", num: true },
  { key: "gp", label: "GS", title: "Games Started", num: true },
  { key: "wins", label: "W", title: "Wins", num: true },
  { key: "losses", label: "L", title: "Losses", num: true },
  { key: "otl", label: "OTL", title: "Overtime / Shootout Losses", num: true },
  { key: "shutouts", label: "SO", title: "Shutouts", num: true },
  { key: "svPct", label: "SV%", title: "Save Percentage", num: true, format: "pct3" },
  { key: "gaa", label: "GAA", title: "Goals-Against Average", num: true, format: "dec2" },
  { key: "shotsAgainst", label: "SA", title: "Shots Against", num: true, defaultHidden: true },
  { key: "goalsAgainst", label: "GA", title: "Goals Against", num: true, defaultHidden: true },
];

export default async function CareerStatsPage({ searchParams }: { searchParams: Promise<{ league?: string; type?: string; phase?: string }> }) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const type = sp.type === "goalies" ? "goalies" : "skaters";
  const playoffs = sp.phase === "playoffs";
  const { skaters, goalies } = await careerLeaderboard(league, playoffs);

  const qs = (over: Record<string, string>) => {
    const q = new URLSearchParams({ ...(league === "AHL" ? { league } : {}), type, ...(playoffs ? { phase: "playoffs" } : {}), ...over });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/stats/career?${q.toString()}`;
  };
  const pill = (active: boolean) => `px-3 py-1.5 rounded-lg border text-xs font-bold transition ${active ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white"}`;

  const skaterRows = skaters.map((s) => ({
    _pid: s.playerId, name: s.name, teamCode: s.teamCode ?? "—", _teamSlug: s.teamSlug ?? "", _teamLogo: s.teamLogo ?? "", pos: s.position,
    seasons: s.seasons, gp: s.gp, goals: s.goals, assists: s.assists, points: s.points, ppg: s.gp ? s.points / s.gp : 0,
    plusMinus: s.plusMinus, pim: s.pim, shots: s.shots, ppGoals: s.ppGoals, shGoals: s.shGoals, gwg: s.gwg, hits: s.hits, blocks: s.blocks,
  }));
  const goalieRows = goalies.map((g) => ({
    _pid: g.playerId, name: g.name, teamCode: g.teamCode ?? "—", _teamSlug: g.teamSlug ?? "", _teamLogo: g.teamLogo ?? "",
    seasons: g.seasons, gp: g.gp, wins: g.wins, losses: g.losses, otl: g.otl, shutouts: g.shutouts, svPct: g.svPct, gaa: g.gaa,
    shotsAgainst: g.shotsAgainst, goalsAgainst: g.goalsAgainst,
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle={`Career totals in the league — ${league} ${playoffs ? "playoffs" : "regular season"}`} />
      <StatsTabs active="career" league={league} />
      <div className="flex flex-wrap gap-2">
        <Link href={qs({ type: "skaters" })} className={pill(type === "skaters")}>Skaters</Link>
        <Link href={qs({ type: "goalies" })} className={pill(type === "goalies")}>Goalies</Link>
        <span className="w-px bg-slate-800 mx-1" />
        <Link href={qs({ phase: "" })} className={pill(!playoffs)}>Regular Season</Link>
        <Link href={qs({ phase: "playoffs" })} className={pill(playoffs)}>Playoffs</Link>
      </div>
      <p className="text-slate-400 text-sm">Every season played in this league, summed — finished seasons from the archive, the current one live. Real-life NHL history is not included. Click a header to sort.</p>
      {type === "skaters"
        ? <StatTable cols={SKATER_COLS} rows={skaterRows} initialSort="points" minWidth={900} />
        : <StatTable cols={GOALIE_COLS} rows={goalieRows} initialSort="wins" minWidth={760} />}
    </div>
  );
}
