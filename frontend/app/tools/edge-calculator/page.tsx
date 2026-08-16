import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import SortableTable, { type SortCol } from "@/components/SortableTable";
import { edgeRatings, edgeGoalieRatings } from "@/lib/edge-params-server";

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

const PARAMS: { key: string; label: string; title: string }[] = [
  { key: "SC", label: "SC", title: "Scoring — goals/60, shots/60, finishing (percentile vs position)" },
  { key: "PA", label: "PA", title: "Passing — assists/60" },
  { key: "CK", label: "CK", title: "Checking — hits/60" },
  { key: "DF", label: "DF", title: "Defense — blocks/60, PK usage, takeaways, +/-" },
  { key: "EN", label: "EN", title: "Endurance — ice time per game" },
  { key: "FO", label: "FO", title: "Faceoffs — win % (centres)" },
  { key: "DI", label: "DI", title: "Discipline — inverse of penalties/60" },
  { key: "ST", label: "ST", title: "Strength — size + physical engagement (hits)" },
  { key: "PH", label: "PH", title: "Puck handling — creation + takeaways, fewer giveaways (approx)" },
  { key: "EX", label: "EX", title: "Experience — age curve (career-GP feed later)" },
  { key: "DU", label: "DU", title: "Durability — games available vs possible" },
  { key: "LD", label: "LD", title: "Leadership — captaincy + experience (commissioner may override)" },
  { key: "OV", label: "OV", title: "Overall — informative average, never enters the sim" },
];

export default async function EdgeCalculatorPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const goalies = type === "goalies";
  const params = goalies ? GOALIE_PARAMS : PARAMS;
  const rows = (goalies ? await edgeGoalieRatings("NHL") : await edgeRatings("NHL")).map((r) => ({
    playerId: r.playerId, name: r.name, teamCode: r.teamCode, position: r.position,
    ...r.ratings,
  }));

  const cols: SortCol[] = [
    { key: "name", label: "Player", kind: "player", sticky: true },
    { key: "teamCode", label: "Team", kind: "team" },
    { key: "position", label: "Pos", kind: "text" },
    ...params.map((p) => ({ key: p.key, label: p.label, kind: "ovr" as const, title: p.title })),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
      <PageHeader title="Edge Parameters" subtitle="Ratings built from real NHL performance — relative, per-60" />
      <div className="flex gap-1.5">
        <Link href="/tools/edge-calculator" className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${!goalies ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>Skaters</Link>
        <Link href="/tools/edge-calculator?type=goalies" className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${goalies ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>Goalies</Link>
      </div>
      <Card>
        <p className="text-sm text-slate-400">
          Each rating is a player&apos;s <b>percentile</b> among peers at his position (F vs F, D vs D), on a <b>per-60</b> basis, blended <b>80%</b> this real season (2025-26) + <b>20%</b> last (2024-25) — so ratings stay stable as the NHL scoring environment shifts.
          <InfoTip text="Relative-to-NHL (not '40 goals = SC 90'): 99th percentile → 99, ~75th → 88, average → ~76, bottom → ~55. Composites: SC = goals/60 + shots/60 + finishing; PA = assists/60; CK = hits/60; DF = blocks/60 + PK usage + takeaways + plus/minus; EN = TOI/game; FO = faceoff %; DI = inverse penalties/60. Updates as the real season progresses. xG / high-danger / EDGE-speed refinements come when a feed is available." />
          {" "}Separate from the STHS Parameters (kept for migration); the sim still runs on STHS for now.
        </p>
      </Card>
      <SortableTable cols={cols} rows={rows} initialSort="SC" minWidth={860} />
    </div>
  );
}
