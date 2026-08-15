"use client";

import { useState, useTransition, useMemo } from "react";
import {
  resolveTactics, PRESETS, DIAL_LABELS, DIAL_DESC, EFFECT_DESC, mergeTactics,
  type TeamTactics, type RosterProfile, type Tempo, type Forecheck, type PuckStyle, type DZone,
} from "@/lib/sim/tactics";
import { saveSystem } from "@/app/teams/[slug]/tactics/actions";

const DIALS = [
  { key: "tempo", label: "Tempo", hint: "How fast you play — pace of the game" },
  { key: "forecheck", label: "Forecheck", hint: "How hard you pressure the puck in the offensive & neutral zones" },
  { key: "puckStyle", label: "Puck Style", hint: "How your offence generates chances" },
  { key: "dZone", label: "D-Zone", hint: "How you defend your own end" },
] as const;

function fitLabel(fit: number): { text: string; cls: string } {
  if (fit >= 1.06) return { text: "Excellent fit — your roster is built for this", cls: "text-emerald-400" };
  if (fit >= 1.02) return { text: "Good fit", cls: "text-emerald-400" };
  if (fit >= 0.98) return { text: "Neutral fit", cls: "text-slate-300" };
  if (fit >= 0.94) return { text: "Below-average fit — you pay the cost for less reward", cls: "text-amber-400" };
  return { text: "Poor fit — this system fights your roster", cls: "text-red-400" };
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
          <p><span className="text-slate-200 font-semibold">Your team&apos;s identity.</span> Pick four dials (or a ready-made preset). Every dial has an upside and a real cost.</p>
          <p><span className="text-emerald-400 font-semibold">System Fit</span> is the key: benefits scale with how well your roster suits the system, but the costs (fatigue, penalties, shots against) apply no matter what — so force a system your players can&apos;t run and you pay the price for little reward. A good coach (high EX) helps execute it.</p>
          <p className="text-slate-500">All-<em>Balanced</em> = no effect, play it straight.</p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Presets <span className="normal-case text-slate-600">— one-click ready systems</span></div>
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
          const desc = DIAL_DESC[d.key][val];
          return (
            <div key={d.key}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="font-semibold">{d.label}</span>
                <span className="text-xs text-slate-500">{d.hint}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(opts).map(([k, lbl]) => (
                  <button key={k}
                    onClick={() => set(d.key, k as Tempo & Forecheck & PuckStyle & DZone)}
                    className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                      val === k ? "bg-blue-600 text-white border-blue-500" : "border-slate-700 text-slate-300 hover:bg-slate-800/60"
                    }`}>
                    {lbl as string}
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
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">System Fit</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black tabular-nums ${fl.cls}`}>{Math.round(eff.fit * 100)}</span>
            <span className="text-slate-500 text-sm">/ 100</span>
          </div>
          <div className="h-2 rounded bg-slate-800 mt-2 overflow-hidden">
            <div className={`h-full ${eff.fit >= 1 ? "bg-emerald-500/70" : "bg-amber-500/70"}`}
              style={{ width: `${Math.max(0, Math.min(100, (eff.fit - 0.6) / 0.55 * 100))}%` }} />
          </div>
          <p className={`text-xs mt-2 ${fl.cls}`}>{fl.text}</p>
          <p className="text-[11px] text-slate-600 mt-1">How well your roster suits the chosen dials (100 = neutral). Higher = your players fit; lower = they don&apos;t.</p>
        </div>

        <div className="bg-slate-900/40 rounded-lg border border-slate-800 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Projected effect <span className="normal-case text-slate-600">— vs a balanced system</span></div>
          <Chip label="Your shot volume" mult={eff.shotRate} title={EFFECT_DESC.shotRate} />
          <Chip label="Shots against" mult={eff.oppShotRate} invert title={EFFECT_DESC.oppShotRate} />
          <Chip label="Your chance quality" mult={eff.dangerMix} title={EFFECT_DESC.dangerMix} />
          <Chip label="Opponent chance quality" mult={eff.oppDangerMult} invert title={EFFECT_DESC.oppDangerMult} />
          <Chip label="Forechecking pressure" mult={eff.takeaway} title={EFFECT_DESC.takeaway} />
          <Chip label="Fatigue" mult={eff.fatigue} invert title={EFFECT_DESC.fatigue} />
          <Chip label="Penalties taken" mult={eff.penaltyMult} invert title={EFFECT_DESC.penaltyMult} />
          <p className="text-[11px] text-slate-600 mt-2">Green = helps you, red = hurts you. Hover a row for what it means.</p>
        </div>

        <button onClick={save} disabled={pending}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-colors">
          {pending ? "Saving…" : saved ? "Saved ✓" : "Save System"}
        </button>
        <p className="text-xs text-slate-600">Benefits scale with fit; costs (fatigue, penalties, shots against) apply in full. Balanced dials = no effect.</p>
      </div>
    </div>
  );
}
