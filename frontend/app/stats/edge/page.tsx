import Link from "next/link";
import { skaterEdge, goalieEdge, teamEdge } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import StatTable, { type Col } from "@/components/StatTable";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

type View = "teams" | "skaters" | "goalies";
const VIEWS: { key: View; label: string }[] = [
  { key: "skaters", label: "Skaters" },
  { key: "goalies", label: "Goalies" },
  { key: "teams", label: "Teams" },
];

const SKATER_COLS: Col[] = [
  { key: "name", label: "Player", title: "Player", frozen: true },
  { key: "teamCode", label: "Team", title: "Team" },
  { key: "pos", label: "Pos", title: "Position" },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "topSkate", label: "Top Speed", title: "Top skating speed, mph (modelled from SK rating)", num: true, format: "dec1" },
  { key: "bursts", label: "22+ Bursts", title: "Speed bursts over 22 mph (modelled)", num: true },
  { key: "miles", label: "Distance", title: "Skating distance, miles (modelled from ice time)", num: true, format: "dec1" },
  { key: "topShot", label: "Top Shot", title: "Fastest shot on goal, mph (tracked)", num: true, format: "dec1" },
  { key: "hits", label: "Hits", title: "Hits", num: true },
];

const GOALIE_COLS: Col[] = [
  { key: "name", label: "Goalie", title: "Goalie", frozen: true },
  { key: "teamCode", label: "Team", title: "Team" },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "svPct", label: "SV%", title: "Overall Save %", num: true, format: "pct3" },
  { key: "hdSv", label: "HD SV%", title: "High-danger save % (slot / net-front)", num: true, format: "pct3" },
  { key: "mdSv", label: "MD SV%", title: "Mid-danger save %", num: true, format: "pct3" },
  { key: "ldSv", label: "LD SV%", title: "Low-danger save % (point / perimeter)", num: true, format: "pct3" },
  { key: "hdShotsAg", label: "HDSA", title: "High-danger shots against", num: true },
];

const TEAM_COLS: Col[] = [
  { key: "name", label: "Team", title: "Team", frozen: true },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "ozPct", label: "OZ%", title: "Offensive-zone time %", num: true, format: "dec1" },
  { key: "nzPct", label: "NZ%", title: "Neutral-zone time %", num: true, format: "dec1" },
  { key: "dzPct", label: "DZ%", title: "Defensive-zone time %", num: true, format: "dec1" },
  { key: "avgShot", label: "Avg Shot", title: "Average shot speed, mph", num: true, format: "dec1" },
  { key: "topShot", label: "Top Shot", title: "Fastest shot, mph", num: true, format: "dec1" },
  { key: "hitsPg", label: "Hits/G", title: "Hits per game", num: true, format: "dec1" },
  { key: "skate", label: "Avg Speed", title: "Roster average top skating speed, mph (modelled)", num: true, format: "dec1" },
];

export default async function EdgeStatsPage({ searchParams }: { searchParams: Promise<{ league?: string; view?: string }> }) {
  const sp = await searchParams;
  const league = sp.league === "AHL" ? "AHL" : "NHL";
  const view: View = sp.view === "goalies" ? "goalies" : sp.view === "teams" ? "teams" : "skaters";
  const q = league === "AHL" ? "&league=AHL" : "";

  let rows: Record<string, string | number>[] = [];
  let cols = SKATER_COLS;
  let initialSort = "topShot";

  if (view === "skaters") {
    const sk = await skaterEdge(SEASON, league);
    rows = sk.filter((s) => s.gp >= 10).map((s) => ({
      name: s.name, teamCode: s.teamCode ?? "—", pos: s.position, gp: s.gp,
      topSkate: s.topSkateSpeed, bursts: s.bursts, miles: s.miles, topShot: s.topShot, hits: s.hits,
    }));
    cols = SKATER_COLS; initialSort = "topShot";
  } else if (view === "goalies") {
    const gk = await goalieEdge(SEASON, league);
    rows = gk.filter((g) => g.hdShotsAg + g.mdShotsAg + g.ldShotsAg >= 150).map((g) => ({
      name: g.name, teamCode: g.teamCode ?? "—", gp: g.gp, svPct: g.svPct,
      hdSv: g.hdSvPct, mdSv: g.mdSvPct, ldSv: g.ldSvPct, hdShotsAg: g.hdShotsAg,
    }));
    cols = GOALIE_COLS; initialSort = "hdSv";
  } else {
    const te = await teamEdge(SEASON, league);
    rows = te.map((t) => ({
      name: t.name, gp: t.gp, ozPct: t.ozPct, nzPct: t.nzPct, dzPct: t.dzPct,
      avgShot: t.avgShot, topShot: t.topShot, hitsPg: t.hitsPerGame, skate: t.avgSkateSpeed,
    }));
    cols = TEAM_COLS; initialSort = "ozPct";
  }

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle={`NHL EDGE — puck & player tracking · ${league} ${SEASON}`} />
      <StatsTabs active="edge" league={league} />

      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/stats/edge?view=${v.key}${q}`}
            className={`px-3 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
              view === v.key ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}>
            {v.label}
          </Link>
        ))}
      </div>

      <p className="text-slate-400 text-sm">
        {view === "skaters" && "Shot speed is tracked from every shot. Skating speed, 22+ mph bursts and distance are modelled from a skater's SK rating and ice time (the sim doesn't simulate stride-level movement)."}
        {view === "goalies" && "Save % split by shot danger — high-danger (slot / net-front), mid-danger (circles) and low-danger (point / perimeter) — all from the sim's per-shot quality."}
        {view === "teams" && "Zone time (offensive / neutral / defensive), shot speed and hits are tracked from the sim. Average skating speed is the roster's modelled SK speed."}
      </p>

      <StatTable cols={cols} rows={rows} initialSort={initialSort} minWidth={820} />

      {view === "skaters" && <p className="text-xs text-slate-600">Minimum 10 GP. Top Shot is tracked; Top Speed / bursts / distance are modelled.</p>}
      {view === "goalies" && <p className="text-xs text-slate-600">Minimum 150 shots against. Real NHL: HD ≈ .80, MD ≈ .92, LD ≈ .98.</p>}
    </div>
  );
}
