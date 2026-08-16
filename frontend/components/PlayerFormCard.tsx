import type { PlayerForm } from "@/lib/form-server";

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

// FORM = what he's producing lately (derived, never stored). A compact block in the
// bio's right column, under Overall. Kept separate from MO (morale, ratings strip).
export default function PlayerFormCard({ form }: { form: PlayerForm }) {
  if (!form) return null;
  return (
    <div className="mt-4 pt-3 border-t border-slate-700/40">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Form</span>
        <span className={`text-base font-black ${form.tone}`}>{form.emoji} {form.label}</span>
        <span className="text-[10px] text-slate-600 ml-auto">last {form.games} · sep. from MO</span>
      </div>
      {form.kind === "skater" ? (
        <div className="text-sm">
          <span className="font-semibold text-slate-200">{form.goals} G — {form.assists} A — {form.points} PTS</span>
          <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
            {form.pointsPer60.toFixed(2)} P/60 · {form.xgPer60.toFixed(2)} xG/60 · {mmss(form.games ? form.toiSec / form.games : 0)} TOI/gm
            {form.positiveShiftPct != null && <> · Positive shifts <span className={form.positiveShiftPct >= 55 ? "text-emerald-400 font-semibold" : form.positiveShiftPct >= 45 ? "text-slate-300 font-semibold" : "text-rose-400 font-semibold"}>{form.positiveShiftPct}%</span></>}
          </div>
        </div>
      ) : (
        <div className="text-sm">
          <span className="font-semibold text-slate-200">{(form.svPct * 100).toFixed(1)}% · {form.gaa.toFixed(2)} GAA</span>
          <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">{form.saves}/{form.shotsAgainst} saves · {form.gsax >= 0 ? "+" : ""}{form.gsax} GSAx</div>
        </div>
      )}
    </div>
  );
}
