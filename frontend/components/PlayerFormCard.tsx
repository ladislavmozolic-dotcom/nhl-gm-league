import type { PlayerForm } from "@/lib/form-server";

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

// FORM = what he's producing lately (derived, never stored) — a slim banner under
// the ratings strip. Kept separate from MO (morale, in the ratings strip).
export default function PlayerFormCard({ form }: { form: PlayerForm }) {
  if (!form) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 bg-slate-800/40 border-t border-slate-800 text-sm">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Form</span>
      <span className={`font-black ${form.tone}`}>{form.emoji} {form.label}</span>
      {form.kind === "skater" ? (
        <>
          <span className="font-semibold text-slate-200">{form.goals} G — {form.assists} A — {form.points} PTS</span>
          <span className="text-xs text-slate-500 tabular-nums">{form.pointsPer60.toFixed(2)} P/60 · {form.xgPer60.toFixed(2)} xG/60 · {mmss(form.games ? form.toiSec / form.games : 0)} TOI/gm</span>
        </>
      ) : (
        <>
          <span className="font-semibold text-slate-200">{(form.svPct * 100).toFixed(1)}% · {form.gaa.toFixed(2)} GAA</span>
          <span className="text-xs text-slate-500 tabular-nums">{form.saves}/{form.shotsAgainst} saves · {form.gsax >= 0 ? "+" : ""}{form.gsax} GSAx</span>
        </>
      )}
      <span className="text-[10px] text-slate-600 ml-auto">last {form.games} · derived, separate from MO</span>
    </div>
  );
}
