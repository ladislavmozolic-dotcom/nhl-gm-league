"use client";

import { useState, useTransition, useMemo } from "react";
import {
  resolveTactics, PRESETS, DIAL_LABELS, EFFECT_DESC, mergeTactics,
  type TeamTactics, type RosterProfile, type Tempo, type Forecheck, type PuckStyle, type DZone,
} from "@/lib/sim/tactics";
import { saveSystem } from "@/app/teams/[slug]/tactics/actions";
import { useT, useLang } from "@/components/LangProvider";
import { dialLabel, dialDesc } from "@/lib/tactics-i18n";

const DIALS = [
  { key: "tempo", labelKey: "sys.dTempo", hintKey: "sys.hintTempo" },
  { key: "forecheck", labelKey: "sys.dForecheck", hintKey: "sys.hintForecheck" },
  { key: "puckStyle", labelKey: "sys.dPuck", hintKey: "sys.hintPuck" },
  { key: "dZone", labelKey: "sys.dDzone", hintKey: "sys.hintDzone" },
] as const;

function fitLabel(fit: number): { key: string; cls: string } {
  if (fit >= 1.06) return { key: "sys.fitExcellent", cls: "text-emerald-400" };
  if (fit >= 1.02) return { key: "sys.fitGood", cls: "text-emerald-400" };
  if (fit >= 0.98) return { key: "sys.fitNeutral", cls: "text-slate-300" };
  if (fit >= 0.94) return { key: "sys.fitBelow", cls: "text-amber-400" };
  return { key: "sys.fitPoor", cls: "text-red-400" };
}

// a signed % chip for an effect multiplier
function Chip({ label, mult, invert = false, title }: { label: string; mult: number; invert?: boolean; title?: string }) {
  const pct = Math.round((mult - 1) * 100);
  const good = invert ? pct < 0 : pct > 0;
  const neutral = pct === 0;
  const cls = neutral ? "text-slate-500" : good ? "text-emerald-400" : "text-red-400";
  return (
    <div className="flex items-center justify-between text-sm py-1 border-b border-slate-800/60" title={title}>
      <span className="text-slate-400 cursor-help border-b border-dotted border-slate-700">{label}</span>
      <span className={`tabular-nums font-semibold ${cls}`}>{pct > 0 ? "+" : ""}{pct}%</span>
    </div>
  );
}

export default function SystemEditor({ teamId, profile, initial, coachEx = 70 }: { teamId: number; profile: RosterProfile; initial: TeamTactics; coachEx?: number }) {
  const tr = useT();
  const lang = useLang();
  const [tac, setTac] = useState<TeamTactics>(mergeTactics(initial));
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const eff = useMemo(() => resolveTactics(tac, profile, coachEx), [tac, profile, coachEx]);
  const fl = fitLabel(eff.fit);

  const set = <K extends keyof TeamTactics>(k: K, v: TeamTactics[K]) => { setTac((t) => ({ ...t, [k]: v, preset: undefined })); setSaved(false); };
  const applyPreset = (name: string) => { setTac(mergeTactics(PRESETS[name])); setSaved(false); };
  const save = () => start(async () => { await saveSystem(teamId, tac); setSaved(true); });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* dials + presets */}
      <div className="space-y-5">
        <div className="bg-slate-900/40 rounded-lg border border-slate-800 p-4 text-sm text-slate-400 space-y-1.5">
          <p><span className="text-slate-200 font-semibold">{tr("sys.identity")}</span> {tr("sys.intro1")}</p>
          <p><span className="text-emerald-400 font-semibold">{tr("sys.fitName")}</span> {tr("sys.intro2")}</p>
          <p className="text-slate-500">{tr("sys.balancedNote")}</p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">{tr("sys.presets")} <span className="normal-case text-slate-600">{tr("sys.presetsHint")}</span></div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(PRESETS).map((name) => (
              <button key={name} onClick={() => applyPreset(name)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-semibold border transition-colors ${
                  tac.preset === name ? "bg-sky-600 text-white border-sky-500" : "border-slate-700 text-slate-300 hover:bg-slate-800/60"
                }`}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {DIALS.map((d) => {
          const opts = DIAL_LABELS[d.key];
          const val = tac[d.key] as string;
          const desc = dialDesc(lang, d.key, val);
          return (
            <div key={d.key}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="font-semibold">{tr(d.labelKey)}</span>
                <span className="text-xs text-slate-500">{tr(d.hintKey)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(opts).map((k) => (
                  <button key={k}
                    onClick={() => set(d.key, k as Tempo & Forecheck & PuckStyle & DZone)}
                    className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                      val === k ? "bg-blue-600 text-white border-blue-500" : "border-slate-700 text-slate-300 hover:bg-slate-800/60"
                    }`}>
                    {dialLabel(lang, d.key, k)}
                  </button>
                ))}
              </div>
              {desc && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{desc}</p>}
            </div>
          );
        })}
      </div>

      {/* fit + effects + save */}
      <div className="space-y-4">
        <div className="bg-slate-900/40 rounded-lg border border-slate-800 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{tr("sys.fitName")}</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black tabular-nums ${fl.cls}`}>{Math.round(eff.fit * 100)}</span>
            <span className="text-slate-500 text-sm">/ 100</span>
          </div>
          <div className="h-2 rounded bg-slate-800 mt-2 overflow-hidden">
            <div className={`h-full ${eff.fit >= 1 ? "bg-emerald-500/70" : "bg-amber-500/70"}`}
              style={{ width: `${Math.max(0, Math.min(100, (eff.fit - 0.6) / 0.55 * 100))}%` }} />
          </div>
          <p className={`text-xs mt-2 ${fl.cls}`}>{tr(fl.key)}</p>
          <p className="text-[11px] text-slate-600 mt-1">{tr("sys.fitDesc")}</p>
        </div>

        <div className="bg-slate-900/40 rounded-lg border border-slate-800 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">{tr("sys.projected")} <span className="normal-case text-slate-600">{tr("sys.projectedHint")}</span></div>
          <Chip label={tr("sys.chipShotVol")} mult={eff.shotRate} title={EFFECT_DESC.shotRate} />
          <Chip label={tr("sys.chipShotsAgainst")} mult={eff.oppShotRate} invert title={EFFECT_DESC.oppShotRate} />
          <Chip label={tr("sys.chipChanceQ")} mult={eff.dangerMix} title={EFFECT_DESC.dangerMix} />
          <Chip label={tr("sys.chipOppChanceQ")} mult={eff.oppDangerMult} invert title={EFFECT_DESC.oppDangerMult} />
          <Chip label={tr("sys.chipForecheck")} mult={eff.takeaway} title={EFFECT_DESC.takeaway} />
          <Chip label={tr("sys.chipFatigue")} mult={eff.fatigue} invert title={EFFECT_DESC.fatigue} />
          <Chip label={tr("sys.chipPenalties")} mult={eff.penaltyMult} invert title={EFFECT_DESC.penaltyMult} />
          <p className="text-[11px] text-slate-600 mt-2">{tr("sys.effectLegend")}</p>
        </div>

        <button onClick={save} disabled={pending}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-colors">
          {pending ? tr("sys.saving") : saved ? tr("sys.savedTick") : tr("sys.save")}
        </button>
        <p className="text-xs text-slate-600">{tr("sys.footer")}</p>
      </div>
    </div>
  );
}
