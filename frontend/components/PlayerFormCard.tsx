import { Card } from "@/components/ui";
import type { PlayerForm } from "@/lib/form-server";

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

// FORM (what he's producing lately) shown alongside MO (his stored morale) — the
// two are deliberately independent.
export default function PlayerFormCard({ form, morale }: { form: PlayerForm; morale: number | null }) {
  return (
    <Card title="Current Form" accent="text-orange-400">
      <div className="flex items-center gap-6">
        {morale != null && (
          <div className="text-center shrink-0">
            <div className="text-2xl font-black text-white tabular-nums">{Math.round(morale)}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">MO · morale</div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          {!form ? (
            <p className="text-sm text-slate-500">No recent games to read form from.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className={`text-lg font-black ${form.tone}`}>{form.emoji} {form.label}</span>
                <span className="text-[11px] text-slate-500">form · last {form.games}</span>
              </div>
              {form.kind === "skater" ? (
                <div className="mt-1 text-sm text-slate-300">
                  <span className="font-semibold">{form.goals} G — {form.assists} A — {form.points} PTS</span>
                  <span className="text-slate-500 ml-2 text-xs tabular-nums">{form.pointsPer60.toFixed(2)} P/60 · {form.xgPer60.toFixed(2)} xG/60 · {mmss(form.games ? form.toiSec / form.games : 0)} TOI/gm</span>
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-300">
                  <span className="font-semibold">{(form.svPct * 100).toFixed(1)}% · {form.gaa.toFixed(2)} GAA</span>
                  <span className="text-slate-500 ml-2 text-xs tabular-nums">{form.saves}/{form.shotsAgainst} saves · {form.gsax >= 0 ? "+" : ""}{form.gsax} GSAx</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-600">MO is his morale (a stored psychological state); form is derived from recent games — they move independently.</p>
    </Card>
  );
}
