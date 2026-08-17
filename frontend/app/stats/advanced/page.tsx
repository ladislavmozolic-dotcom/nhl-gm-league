import { skaterTotals, goalieTotals } from "@/lib/stats-server";
import StatsTabs from "@/components/StatsTabs";
import StatTable, { type Col } from "@/components/StatTable";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

// Phase 2 shot-quality leaderboards: individual expected goals + finishing for
// skaters, goals-saved-above-expected for goalies. All derived from the sim's
// per-shot xG (see lib/sim/shot-quality.ts).
const SKATER_COLS: Col[] = [
  { key: "name", label: "Player", title: "Player Name", frozen: true },
  { key: "teamCode", label: "Team", title: "Team" },
  { key: "pos", label: "Pos", title: "Position" },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "goals", label: "G", title: "Goals", num: true },
  { key: "xg", label: "xG", title: "Expected Goals (shot quality generated)", info: "Expected Goals — how many goals an average shooter would score from the shots he took, based on where and how they were taken. A measure of chance quality, independent of finishing.", num: true, format: "dec1" },
  { key: "fin", label: "G−xG", title: "Finishing: goals above expected", info: "Finishing — actual goals minus expected goals. Positive = an elite finisher who beats his chances; negative = leaving goals on the table.", num: true, format: "plusDec1" },
  { key: "hdShots", label: "HDS", title: "High-danger shots (slot / net-front)", info: "High-Danger Shots — attempts from the slot or right at the net, where goals are most likely.", num: true },
  { key: "shots", label: "S", title: "Shots on goal", num: true },
  { key: "shPct", label: "S%", title: "Shooting %", num: true, format: "dec1" },
  { key: "points", label: "P", title: "Points", num: true },
];

const GOALIE_COLS: Col[] = [
  { key: "name", label: "Goalie", title: "Goalie Name", frozen: true },
  { key: "teamCode", label: "Team", title: "Team" },
  { key: "gp", label: "GP", title: "Games Played", num: true },
  { key: "gsax", label: "GSAx", title: "Goals Saved Above Expected (xGA − GA)", info: "Goals Saved Above Expected — expected goals against minus goals actually allowed. The single best measure of goalie quality: positive = he's stealing games, negative = letting in ones he shouldn't.", num: true, format: "plusDec1" },
  { key: "xga", label: "xGA", title: "Expected Goals Against faced", info: "Expected Goals Against — how many goals an average goalie would have allowed on the shots he faced. Compare to actual GA to judge him.", num: true, format: "dec1" },
  { key: "goalsAgainst", label: "GA", title: "Goals Against", num: true },
  { key: "svPct", label: "PCT", title: "Save Percentage", num: true, format: "pct3" },
  { key: "gaa", label: "GAA", title: "Goals-Against Average", num: true, format: "dec2" },
  { key: "shotsAgainst", label: "SA", title: "Shots Against", num: true },
];

export default async function AdvancedStatsPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const league = (await searchParams).league === "AHL" ? "AHL" : "NHL";
  const [sk, gk] = await Promise.all([skaterTotals(SEASON, league), goalieTotals(SEASON, league)]);

  // adaptive minimums — show from the early games, tighten as the sample grows
  const skShotMin = Math.min(20, Math.max(1, Math.ceil(sk.reduce((m, s) => Math.max(m, s.shots), 0) * 0.4)));
  const gkSaMin = Math.min(150, Math.max(1, Math.ceil(gk.reduce((m, g) => Math.max(m, g.shotsAgainst), 0) * 0.4)));

  const skaterRows = sk
    .filter((s) => s.shots >= skShotMin)
    .map((s) => ({
      name: s.name, teamCode: s.teamCode ?? "—", pos: s.position, gp: s.gp,
      goals: s.goals, xg: s.xg, fin: s.goals - s.xg, hdShots: s.hdShots, shots: s.shots,
      shPct: s.shots ? (s.goals / s.shots) * 100 : 0, points: s.points,
    }));

  const goalieRows = gk
    .filter((g) => g.shotsAgainst >= gkSaMin)
    .map((g) => ({
      name: g.name, teamCode: g.teamCode ?? "—", gp: g.gp, gsax: g.gsax, xga: g.xga,
      goalsAgainst: g.goalsAgainst, svPct: g.svPct, gaa: g.gaa, shotsAgainst: g.shotsAgainst,
    }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle={`Advanced — shot quality & expected goals · ${league} ${SEASON}`} />
      <StatsTabs active="advanced" league={league} />
      <p className="text-slate-400 text-sm">
        Expected goals (xG) rate every shot by its location, type and situation — independent of who shot it or who was
        in net. A skater’s <strong>G−xG</strong> is pure finishing; a goalie’s <strong>GSAx</strong> is goals saved
        above expected. Click a header to sort.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Skaters — expected goals &amp; finishing</h2>
        <StatTable cols={SKATER_COLS} rows={skaterRows} initialSort="xg" minWidth={860} />
        <p className="text-xs text-slate-600">Minimum {skShotMin} shots (scales up to 20). G−xG above zero = finished better than an average shooter would from those spots.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Goalies — goals saved above expected</h2>
        <StatTable cols={GOALIE_COLS} rows={goalieRows} initialSort="gsax" minWidth={760} />
        <p className="text-xs text-slate-600">Minimum {gkSaMin} shots against (scales up to 150). GSAx above zero = stopped more than the shot quality faced would predict.</p>
      </section>
    </div>
  );
}
