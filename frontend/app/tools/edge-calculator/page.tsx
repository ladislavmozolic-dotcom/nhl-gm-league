import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import SortableTable, { type SortCol } from "@/components/SortableTable";
import { edgeRatings, edgeGoalieRatings, edgeAhlSkaterRatings } from "@/lib/edge-params-server";
import { RATING_BANDS } from "@/lib/edge-params";
import EdgeTeamSelect from "@/components/EdgeTeamSelect";

export const dynamic = "force-dynamic";

const GOALIE_PARAMS: { key: string; label: string; title: string }[] = [
  { key: "SC", label: "SC", title: "Style Control — low/med-danger stops + GSAx (positioning)" },
  { key: "RT", label: "RT", title: "Reaction Time — high-danger stops + high-danger GSAx" },
  { key: "HS", label: "HS", title: "Hand Speed — quick stops, high-danger leaning" },
  { key: "AG", label: "AG", title: "Agility — lateral / mid-range coverage" },
  { key: "RB", label: "RB", title: "Rebound Control — fewer rebounds than expected (MoneyPuck)" },
  { key: "EN", label: "EN", title: "Endurance — starter workload (ice time)" },
  { key: "SZ", label: "SZ", title: "Size — height" },
  { key: "EX", label: "EX", title: "Experience — age curve" },
  { key: "DU", label: "DU", title: "Durability — availability" },
  { key: "LD", label: "LD", title: "Leadership — captaincy + experience" },
  { key: "OV", label: "OV", title: "Overall — informative average" },
];

const AHL_PARAMS: { key: string; label: string; title: string }[] = [
  { key: "SC", label: "SC", title: "Scoring — AHL goals/shots translated to NHL-equivalent, vs NHL distribution" },
  { key: "PA", label: "PA", title: "Passing — AHL assists translated to NHL-equivalent" },
  { key: "DI", label: "DI", title: "Discipline — inverse of PIM per game" },
  { key: "ST", label: "ST", title: "Strength — size (AHL feed lacks hits)" },
  { key: "EX", label: "EX", title: "Experience — age curve" },
  { key: "DU", label: "DU", title: "Durability — availability" },
  { key: "LD", label: "LD", title: "Leadership — captaincy + experience" },
  { key: "OV", label: "OV", title: "Overall — informative average" },
];

// STHS's 15 rated skater attributes + OV (MO/morale is dynamic, starts at 50).
const PARAMS: { key: string; label: string; title: string }[] = [
  { key: "SK", label: "SK", title: "Skating — real NHL EDGE tracking: top speed + speed bursts over 20mph (percentiles)" },
  { key: "CK", label: "CK", title: "Checking — hits/60" },
  { key: "FG", label: "FG", title: "Fighting — penalty-minute load + hits (no fighting-major feed)" },
  { key: "DI", label: "DI", title: "Discipline — inverse of penalties/60" },
  { key: "ST", label: "ST", title: "Strength — size + physical engagement (hits)" },
  { key: "EN", label: "EN", title: "Endurance — ice time per game" },
  { key: "DU", label: "DU", title: "Durability — games available vs possible" },
  { key: "PH", label: "PH", title: "Puck handling — creation + takeaways, fewer giveaways (approx)" },
  { key: "FO", label: "FO", title: "Faceoffs — win % (centres)" },
  { key: "PA", label: "PA", title: "Passing — assists/60" },
  { key: "SC", label: "SC", title: "Scoring — goals/60, shots/60, finishing" },
  { key: "DF", label: "DF", title: "Defense — blocks/60, PK usage, takeaways, +/- (position-specific)" },
  { key: "PS", label: "PS", title: "Penalty shot — finishing + offensive touch (breakaway conversion)" },
  { key: "EX", label: "EX", title: "Experience — age curve (career-GP feed later)" },
  { key: "LD", label: "LD", title: "Leadership — captaincy + experience (commissioner may override)" },
  { key: "OV", label: "OV", title: "Overall — informative average, never enters the sim" },
];

export default async function EdgeCalculatorPage({ searchParams }: { searchParams: Promise<{ type?: string; team?: string }> }) {
  const { type, team } = await searchParams;
  const goalies = type === "goalies";
  const ahl = type === "ahl";
  const params = goalies ? GOALIE_PARAMS : ahl ? AHL_PARAMS : PARAMS;
  const engine = goalies ? edgeGoalieRatings("NHL") : ahl ? edgeAhlSkaterRatings() : edgeRatings("NHL");
  const all = (await engine).map((r) => ({
    playerId: r.playerId, name: r.name, teamCode: r.teamCode, position: r.position,
    ...r.ratings,
  }));
  const teamCodes = [...new Set(all.map((r) => r.teamCode).filter((c): c is string => !!c))].sort();
  const rows = team ? all.filter((r) => r.teamCode === team) : all;

  const cols: SortCol[] = [
    { key: "name", label: "Player", kind: "player", sticky: true },
    { key: "teamCode", label: "Team", kind: "team" },
    { key: "position", label: "Pos", kind: "text" },
    ...params.map((p) => ({ key: p.key, label: p.label, kind: "ovr" as const, title: p.title })),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
      <PageHeader title="Edge Parameters" subtitle="Ratings built from real NHL performance — relative, per-60" />
      <div className="flex gap-1.5 items-center flex-wrap">
        <Link href={`/tools/edge-calculator${team ? `?team=${team}` : ""}`} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${!goalies ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>Skaters</Link>
        <Link href={`/tools/edge-calculator?type=goalies${team ? `&team=${team}` : ""}`} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${goalies ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>Goalies</Link>
        <Link href={`/tools/edge-calculator?type=ahl${team ? `&team=${team}` : ""}`} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${ahl ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>AHL Skaters</Link>
        <span className="ml-2"><EdgeTeamSelect teams={teamCodes} value={team ?? ""} /></span>
      </div>
      <Card>
        <p className="text-sm text-slate-400">
          Ratings are built from real performance — <b>per-60</b>, blended <b>80%</b> this real season (2025-26) + <b>20%</b> last (2024-25) — then <b>calibrated onto the STHS value scale</b> so they read like your existing parameters (SC forward-max ~74, D-max ~61; DF higher for D; overall 50-70). A player keeps his live, data-driven <b>rank</b> but takes the STHS value at that rank.
          <InfoTip text="Two numbers per player. Ability Rating (shown here) is on the STHS scale — what the engine would use. Position Percentile (posPct, e.g. 'Scoring 99th among D') is the analytics number for the profile. SC uses a common F+D scale (a D shooting from the point is lifted slightly as a shot-quality proxy); DF/FO are position-specific. Composites: SC = goals/60 + shots/60 + finishing; PA = assists/60; CK = hits/60; DF = blocks/60 + PK + takeaways + plus/minus; EN = TOI/game; FO = faceoff %; DI = inverse penalties/60. Updates as the season progresses." />
          {" "}Separate from the STHS Parameters (kept for migration); the sim still runs on STHS for now.
        </p>
      </Card>
      <Card>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Rating distribution
          <InfoTip text="How many players fall in each rating band per parameter. If a band suddenly balloons (e.g. 100+ players at 90+), the curve or input data is off. A percentile is only a mid-step — the non-linear curve decides how rare 90/95/99 are." />
        </div>
        <div className="overflow-x-auto">
          <table className="text-[12px] tabular-nums">
            <thead><tr className="text-slate-500 text-left"><th className="pr-3 py-1">Param</th>{RATING_BANDS.map((b) => <th key={b.label} className="px-2 py-1 text-right">{b.label}</th>)}</tr></thead>
            <tbody>
              {params.filter((p) => p.key !== "MO" && p.key !== "OV").map((p) => {
                const vals = all.map((r) => (r as any)[p.key]).filter((v) => v != null) as number[];
                return (
                  <tr key={p.key} className="border-t border-slate-800/50">
                    <td className="pr-3 py-1 font-semibold text-slate-300">{p.label}</td>
                    {RATING_BANDS.map((b) => {
                      const n = vals.filter((v) => v >= b.min && v <= b.max).length;
                      return <td key={b.label} className={`px-2 py-1 text-right ${b.min >= 90 ? "text-emerald-300" : "text-slate-400"}`}>{n || "·"}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <SortableTable cols={cols} rows={rows} initialSort="SC" minWidth={860} />
    </div>
  );
}
