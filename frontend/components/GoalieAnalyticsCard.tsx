import { Card } from "@/components/ui";
import type { GoalieAnalytics, DangerSplit } from "@/lib/goalie-analytics-server";

const svTone = (pct: number, danger: "hd" | "md" | "ld" | "all") => {
  const good = danger === "hd" ? 0.82 : danger === "md" ? 0.9 : danger === "ld" ? 0.96 : 0.91;
  const ok = danger === "hd" ? 0.78 : danger === "md" ? 0.87 : danger === "ld" ? 0.94 : 0.895;
  return pct >= good ? "text-emerald-400" : pct >= ok ? "text-sky-400" : "text-rose-400";
};
const FAT_TONE: Record<string, string> = { Fresh: "text-emerald-400", Normal: "text-slate-300", Elevated: "text-amber-400", High: "text-rose-400" };

function DangerRow({ label, d, danger }: { label: string; d: DangerSplit; danger: "hd" | "md" | "ld" }) {
  const pct = d.svPct * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-slate-400 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full rounded-full ${danger === "hd" ? "bg-rose-500" : danger === "md" ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <span className={`w-12 text-right text-sm font-bold tabular-nums ${svTone(d.svPct, danger)}`}>{d.shots ? pct.toFixed(1) : "—"}</span>
      <span className="w-12 text-right text-[11px] text-slate-600 tabular-nums">{d.shots} sh</span>
    </div>
  );
}

export default function GoalieAnalyticsCard({ a }: { a: GoalieAnalytics }) {
  if (!a) return null;
  const f = a.fatigue;
  return (
    <Card title="Goalie Analytics" accent="text-emerald-400">
      {/* headline tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Tile big={`${(a.svPct * 100).toFixed(1)}`} label="SV%" tone={svTone(a.svPct, "all")} />
        <Tile big={`${a.gsax >= 0 ? "+" : ""}${a.gsax}`} label="GSAx" tone={a.gsax >= 0 ? "text-emerald-400" : "text-rose-400"} sub="goals saved vs xG" />
        <Tile big={`${a.xga.toFixed(1)}`} label="xGA" sub={`${a.goalsAgainst} allowed`} />
        <Tile big={a.gaa.toFixed(2)} label="GAA" sub={`${a.gp} GP`} />
      </div>

      {/* danger split */}
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Save % by shot danger</div>
        <div className="space-y-1.5">
          <DangerRow label="High-danger" d={a.high} danger="hd" />
          <DangerRow label="Mid-danger" d={a.mid} danger="md" />
          <DangerRow label="Low-danger" d={a.low} danger="ld" />
        </div>
      </div>

      {/* trend + fatigue */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="bg-slate-800/40 rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Last {a.last10.gp} — trend</div>
          <div className={`text-lg font-black ${a.last10.gsax >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{a.last10.gsax >= 0 ? "+" : ""}{a.last10.gsax} <span className="text-xs font-normal text-slate-400">goals saved above expected</span></div>
          <div className="text-[11px] text-slate-500">{(a.last10.svPct * 100).toFixed(1)}% over the stretch</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Workload</div>
          <div className={`text-lg font-black ${FAT_TONE[f.level]}`}>Fatigue: {f.level}</div>
          <div className="text-[11px] text-slate-500">{f.note} <span className="text-slate-600">CON {f.condition}%</span></div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-600">Rebound control, rush &amp; screened-shot splits arrive with deeper shot tracking.</p>
    </Card>
  );
}

function Tile({ big, label, sub, tone }: { big: string; label: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-slate-800/40 rounded-lg p-3 text-center">
      <div className={`text-2xl font-black tabular-nums ${tone ?? "text-white"}`}>{big}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-600">{sub}</div>}
    </div>
  );
}
