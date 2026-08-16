import { Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import type { TeamDna } from "@/lib/team-dna-server";

const barColor = (v: number) => (v >= 66 ? "bg-emerald-500" : v >= 40 ? "bg-blue-500" : "bg-slate-500");

// what feeds each dimension (roster attributes, overall-weighted, then ranked vs the league)
const DIM_INFO: Record<string, string> = {
  Speed: "Skaters' Skating (SK). How fast the group moves.",
  Skill: "55% Shooting (SC) + 45% Passing (PA). Offensive skill / finish & playmaking.",
  Physical: "60% Checking (CK) + 40% Strength (ST). How heavy and physical the group is.",
  Defense: "60% Defence (DF) + 40% Defensive Instinct (DI). Ability to defend and read plays.",
  Transition: "50% Skating (SK) + 50% Passing (PA). Moving the puck up ice quickly.",
  Forecheck: "55% Checking (CK) + 45% Endurance (EN). Pressuring the puck and sustaining it.",
};

export default function TeamDnaCard({ dna }: { dna: TeamDna }) {
  return (
    <Card title="Team DNA" accent="text-fuchsia-400">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Identity</div>
          <div className="text-xl font-black text-white">{dna.identity}</div>
        </div>
        {dna.record && <div className="text-sm text-slate-400 tabular-nums">{dna.record}</div>}
      </div>

      <div className="space-y-2.5">
        {dna.bars.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <div className="w-28 text-sm text-slate-400 shrink-0">{b.label}{DIM_INFO[b.label] && <InfoTip text={DIM_INFO[b.label]} />}</div>
            <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${barColor(b.value)}`} style={{ width: `${b.value}%` }} />
            </div>
            <div className="w-8 text-right text-xs tabular-nums text-slate-500">{b.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-slate-400">Strength: <b className="text-emerald-400">{dna.strength}</b></span>
        <span className="text-slate-400">Area to address: <b className="text-amber-400">{dna.weakness}</b></span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{dna.blurb}</p>
      <p className="mt-1 text-[11px] text-slate-600">Bars are league-relative (0 = softest in the league, 100 = strongest) and update as the roster changes.</p>
    </Card>
  );
}
