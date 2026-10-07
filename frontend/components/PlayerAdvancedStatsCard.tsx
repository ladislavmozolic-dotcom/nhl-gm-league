import { Card } from "@/components/ui";

export type SituationRow = {
  situation: string;
  toi: number;
  goals: number;
  assists: number;
  points: number;
  shots: number;
  xg: number;
  plusMinus: number;
};

export type SkaterAdvancedMetrics = {
  xg: number;
  goals: number;
  hdShots: number;
  shots: number;
  topShot: number;
  shifts: number;
  positiveShifts: number;
  situations: SituationRow[];
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

const SITUATION_LABELS: Record<string, { label: string; badgeCls: string }> = {
  "5V5": { label: "Even Strength (5v5)", badgeCls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  PP: { label: "Power Play (PP)", badgeCls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  PK: { label: "Penalty Kill (PK)", badgeCls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  "3V3": { label: "Overtime (3v3)", badgeCls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  "4V4": { label: "4-on-4 Play", badgeCls: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  EN_OWN: { label: "Empty Net (Defending)", badgeCls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  EN_OPP: { label: "Empty Net (Attacking)", badgeCls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
};

export default function PlayerAdvancedStatsCard({ metrics }: { metrics: SkaterAdvancedMetrics }) {
  const finishing = metrics.goals - metrics.xg;
  const finishingCls = finishing >= 0 ? "text-emerald-400" : "text-rose-400";
  const hdPct = metrics.shots > 0 ? (metrics.hdShots / metrics.shots) * 100 : 0;
  const shiftPct = metrics.shifts > 0 ? (metrics.positiveShifts / metrics.shifts) * 100 : null;

  return (
    <Card title="Advanced Analytics & Situation Splits" bodyClassName="p-4 space-y-5">
      {/* 4 KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* xG */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Expected Goals (xG)</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white tabular-nums">{metrics.xg.toFixed(1)}</span>
            <span className="text-xs text-slate-400">vs {metrics.goals} G</span>
          </div>
          <div className="mt-1 text-xs font-semibold tabular-nums">
            Finishing: <span className={finishingCls}>{finishing >= 0 ? "+" : ""}{finishing.toFixed(1)} G</span>
          </div>
        </div>

        {/* High Danger Shots */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">High-Danger Shots</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-300 tabular-nums">{metrics.hdShots}</span>
            <span className="text-xs text-slate-400">of {metrics.shots} S</span>
          </div>
          <div className="mt-1 text-xs text-slate-400 tabular-nums">
            <span className="text-amber-400 font-semibold">{hdPct.toFixed(1)}%</span> slot & net-front
          </div>
        </div>

        {/* EDGE Top Speed */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">EDGE Top Shot Speed</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-cyan-300 tabular-nums">
              {metrics.topShot > 0 ? metrics.topShot.toFixed(1) : "—"}
            </span>
            {metrics.topShot > 0 && <span className="text-xs text-slate-400 font-medium">mph</span>}
          </div>
          <div className="mt-1 text-xs text-slate-400">Fastest shot clocked</div>
        </div>

        {/* Shift Quality */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Shift Quality</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400 tabular-nums">
              {shiftPct != null ? `${shiftPct.toFixed(1)}%` : "—"}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400 tabular-nums">
            {metrics.positiveShifts} / {metrics.shifts} positive xG shifts
          </div>
        </div>
      </div>

      {/* Situations table */}
      {metrics.situations.length > 0 && (
        <div className="rounded-xl border border-slate-800/80 overflow-hidden bg-slate-900/40">
          <div className="px-3.5 py-2 bg-slate-800/50 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-300">
            Situation Breakdown
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[540px]">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-800/20">
                  <th className="px-3 py-2 text-left font-medium">Situation</th>
                  <th className="px-2.5 py-2 text-right font-medium">TOI</th>
                  <th className="px-2.5 py-2 text-right font-medium">G</th>
                  <th className="px-2.5 py-2 text-right font-medium">A</th>
                  <th className="px-2.5 py-2 text-right font-medium">PTS</th>
                  <th className="px-2.5 py-2 text-right font-medium">S</th>
                  <th className="px-2.5 py-2 text-right font-medium">S%</th>
                  <th className="px-2.5 py-2 text-right font-medium">xG</th>
                  <th className="px-2.5 py-2 text-right font-medium">+/-</th>
                </tr>
              </thead>
              <tbody>
                {metrics.situations.map((sit) => {
                  const sInfo = SITUATION_LABELS[sit.situation] ?? {
                    label: sit.situation,
                    badgeCls: "bg-slate-700/30 text-slate-300 border-slate-600/30",
                  };
                  const sPct = sit.shots > 0 ? (sit.goals / sit.shots) * 100 : null;
                  return (
                    <tr key={sit.situation} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20">
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${sInfo.badgeCls}`}>
                          {sInfo.label}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums text-slate-300">{mmss(sit.toi)}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums font-semibold text-white">{sit.goals}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums text-slate-300">{sit.assists}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums font-bold text-white">{sit.points}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums text-slate-300">{sit.shots}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums text-slate-400">
                        {sPct != null ? `${sPct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums font-medium text-cyan-300">{sit.xg.toFixed(2)}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums font-medium">
                        {sit.plusMinus > 0 ? (
                          <span className="text-emerald-400">+{sit.plusMinus}</span>
                        ) : sit.plusMinus < 0 ? (
                          <span className="text-rose-400">{sit.plusMinus}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
