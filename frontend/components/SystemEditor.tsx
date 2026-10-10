"use client";

import { useState, useTransition, useMemo } from "react";
import {
  resolveTactics,
  PRESETS,
  DIAL_LABELS,
  EFFECT_DESC,
  mergeTactics,
  type TeamTactics,
  type RosterProfile,
  type Tempo,
  type Forecheck,
  type PuckStyle,
  type DZone,
} from "@/lib/sim/tactics";
import { useT, useLang } from "@/components/LangProvider";
import { dialLabel, dialDesc, presetLabel } from "@/lib/tactics-i18n";

const PRESET_ICONS: Record<string, string> = {
  Balanced: "⚖️",
  "Run-and-Gun": "⚡",
  Trap: "🕸️",
  "Heavy Forecheck": "💥",
  "Shot Volume": "🎯",
  Shutdown: "🛡️",
};

const DIALS = [
  { key: "tempo", labelKey: "sys.dTempo", hintKey: "sys.hintTempo", icon: "⏱️" },
  { key: "forecheck", labelKey: "sys.dForecheck", hintKey: "sys.hintForecheck", icon: "⚔️" },
  { key: "puckStyle", labelKey: "sys.dPuck", hintKey: "sys.hintPuck", icon: "🏒" },
  { key: "dZone", labelKey: "sys.dDzone", hintKey: "sys.hintDzone", icon: "🛡️" },
] as const;

function fitLabel(fit: number): { key: string; cls: string; badgeCls: string } {
  if (fit >= 1.06)
    return {
      key: "sys.fitExcellent",
      cls: "text-emerald-400",
      badgeCls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    };
  if (fit >= 1.02)
    return {
      key: "sys.fitGood",
      cls: "text-emerald-400",
      badgeCls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    };
  if (fit >= 0.98)
    return {
      key: "sys.fitNeutral",
      cls: "text-slate-300",
      badgeCls: "bg-slate-800 text-slate-300 border-slate-700",
    };
  if (fit >= 0.94)
    return {
      key: "sys.fitBelow",
      cls: "text-amber-400",
      badgeCls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    };
  return {
    key: "sys.fitPoor",
    cls: "text-rose-400",
    badgeCls: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };
}

function Chip({
  label,
  mult,
  invert = false,
  title,
}: {
  label: string;
  mult: number;
  invert?: boolean;
  title?: string;
}) {
  const pct = Math.round((mult - 1) * 100);
  const good = invert ? pct < 0 : pct > 0;
  const neutral = pct === 0;
  const cls = neutral
    ? "text-slate-400 bg-slate-850"
    : good
    ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold"
    : "text-rose-300 bg-rose-500/15 border-rose-500/30 font-bold";

  return (
    <div
      className="flex items-center justify-between text-xs py-2 px-2.5 rounded-xl hover:bg-slate-800/40 transition-colors"
      title={title}
    >
      <span className="text-slate-300 font-medium cursor-help">{label}</span>
      <span className={`tabular-nums text-xs px-2 py-0.5 rounded-lg border border-transparent ${cls}`}>
        {pct > 0 ? "+" : ""}
        {pct}%
      </span>
    </div>
  );
}

export default function SystemEditor({
  teamId,
  profile,
  initial,
  coachEx = 70,
}: {
  teamId: number;
  profile: RosterProfile;
  initial: TeamTactics;
  coachEx?: number;
}) {
  const tr = useT();
  const lang = useLang();
  const isCs = lang === "cs";

  const [tac, setTac] = useState<TeamTactics>(mergeTactics(initial));
  const [savedTac, setSavedTac] = useState<TeamTactics>(mergeTactics(initial));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const eff = useMemo(() => resolveTactics(tac, profile, coachEx), [tac, profile, coachEx]);
  const fl = fitLabel(eff.fit);

  const set = <K extends keyof TeamTactics>(k: K, v: TeamTactics[K]) => {
    setTac((t) => ({ ...t, [k]: v }));
    setSaved(false);
    setError(null);
  };

  const dialsOf = (t: TeamTactics) => ({
    tempo: t.tempo, forecheck: t.forecheck, puckStyle: t.puckStyle, dZone: t.dZone,
    ppStyle: t.ppStyle ?? "balanced", pkStyle: t.pkStyle ?? "balanced",
  });

  const applyPreset = (name: string) => {
    // Restore the manager's own tweaks for this preset if they saved any, else the stock preset.
    const custom = tac.presetOverrides?.[name];
    setTac(mergeTactics({ ...PRESETS[name], ...(custom ?? {}), preset: name, presetOverrides: tac.presetOverrides }));
    setSaved(false);
    setError(null);
  };

  const save = () =>
    start(async () => {
      try {
        const response = await fetch(`/api/teams/${teamId}/tactics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Remember the current dials under the active preset (dropped again if they equal the stock preset).
          body: JSON.stringify({
            ...tac,
            presetOverrides: (() => {
              const ov = { ...(tac.presetOverrides ?? {}) };
              const p = tac.preset;
              if (p && PRESETS[p]) {
                const cur = dialsOf(tac);
                const base = dialsOf(mergeTactics(PRESETS[p]));
                if (JSON.stringify(cur) === JSON.stringify(base)) delete ov[p];
                else ov[p] = cur;
              }
              return ov;
            })(),
          }),
        });
        const res = (await response.json()) as { ok: true; tactics: TeamTactics } | { ok: false; error?: string };
        if (res.ok) {
          setTac(res.tactics);
          setSavedTac(res.tactics);
          setSaved(true);
          setError(null);
        } else {
          setSaved(false);
          setError(res.error ?? "save failed");
        }
      } catch (e) {
        setSaved(false);
        setError(e instanceof Error ? e.message : "save failed");
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Tactical Dials & Presets (Left Column) */}
      <div className="space-y-6">
        {/* Intro Card */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-4 sm:p-5 text-xs sm:text-sm text-slate-300 space-y-2 shadow-xl backdrop-blur-md">
          <p>
            <span className="text-white font-extrabold">{tr("sys.identity")}</span> {tr("sys.intro1")}
          </p>
          <p>
            <span className="text-emerald-400 font-extrabold">{tr("sys.fitName")}</span> {tr("sys.intro2")}
          </p>
          <p className="text-slate-400 text-xs">{tr("sys.balancedNote")}</p>
        </div>

        {/* Tactical Presets */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-4 sm:p-5 shadow-xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>📋</span>
              <span>{tr("sys.presets")}</span>
            </h3>
            <span className="text-xs text-slate-500">{tr("sys.presetsHint")}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {Object.keys(PRESETS).map((name) => {
              const active = tac.preset === name;
              const icon = PRESET_ICONS[name] || "🏒";
              return (
                <button
                  type="button"
                  key={name}
                  onClick={() => applyPreset(name)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                    active
                      ? "bg-blue-600/25 border-blue-500 text-white shadow-md shadow-blue-600/20 ring-1 ring-blue-400/40"
                      : "bg-slate-850/60 border-slate-700/60 text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{icon}</span>
                    {active && (
                      <span className="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400" />
                    )}
                  </div>
                  <span className="font-bold text-xs truncate mt-1">
                    {presetLabel(lang, name)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 System Dials */}
        <div className="space-y-4">
          {DIALS.map((d) => {
            const opts = DIAL_LABELS[d.key];
            const val = tac[d.key] as string;
            const desc = dialDesc(lang, d.key, val);

            return (
              <div
                key={d.key}
                className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-4 sm:p-5 shadow-xl backdrop-blur-md space-y-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{d.icon}</span>
                    <span className="font-extrabold text-sm text-white tracking-tight">
                      {tr(d.labelKey)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{tr(d.hintKey)}</span>
                </div>

                {/* Segmented selector */}
                <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-850/80 border border-slate-700/60">
                  {Object.keys(opts).map((k) => {
                    const isSelected = val === k;
                    return (
                      <button
                        type="button"
                        key={k}
                        onClick={() => set(d.key, k as Tempo & Forecheck & PuckStyle & DZone)}
                        className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                        }`}
                      >
                        {dialLabel(lang, d.key, k)}
                      </button>
                    );
                  })}
                </div>

                {desc && (
                  <p className="text-xs text-slate-400 leading-relaxed bg-slate-850/40 p-2.5 rounded-xl border border-slate-800/60">
                    💡 {desc}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fit Gauge & Simulation Projection (Right Sidebar) */}
      <div className="space-y-5">
        {/* System Fit Gauge Card */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-5 shadow-xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {tr("sys.fitName")}
            </span>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${fl.badgeCls}`}>
              {tr(fl.key)}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-black tabular-nums tracking-tight ${fl.cls}`}>
              {Math.round(eff.fit * 100)}
            </span>
            <span className="text-slate-500 text-xs font-mono">/ 100</span>
          </div>

          <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden p-0.5 border border-slate-700/60">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                eff.fit >= 1.02 ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : eff.fit >= 0.98 ? "bg-blue-400" : "bg-amber-400"
              }`}
              style={{ width: `${Math.max(0, Math.min(100, ((eff.fit - 0.6) / 0.55) * 100))}%` }}
            />
          </div>

          <p className="text-xs text-slate-400 leading-relaxed pt-1 border-t border-slate-800/60">
            {tr("sys.fitDesc")}
          </p>
        </div>

        {/* Projected Simulation Impact */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-5 shadow-xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {tr("sys.projected")}
            </span>
            <span className="text-[11px] text-slate-500">{tr("sys.projectedHint")}</span>
          </div>

          <div className="divide-y divide-slate-800/40">
            <Chip label={tr("sys.chipShotVol")} mult={eff.shotRate} title={EFFECT_DESC.shotRate} />
            <Chip label={tr("sys.chipShotsAgainst")} mult={eff.oppShotRate} invert title={EFFECT_DESC.oppShotRate} />
            <Chip label={tr("sys.chipChanceQ")} mult={eff.dangerMix} title={EFFECT_DESC.dangerMix} />
            <Chip label={tr("sys.chipOppChanceQ")} mult={eff.oppDangerMult} invert title={EFFECT_DESC.oppDangerMult} />
            <Chip label={tr("sys.chipForecheck")} mult={eff.takeaway} title={EFFECT_DESC.takeaway} />
            <Chip label={tr("sys.chipFatigue")} mult={eff.fatigue} invert title={EFFECT_DESC.fatigue} />
            <Chip label={tr("sys.chipPenalties")} mult={eff.penaltyMult} invert title={EFFECT_DESC.penaltyMult} />
          </div>

          <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
            {tr("sys.effectLegend")}
          </p>
        </div>

        {/* Save Tactical System Button */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
          >
            {pending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{tr("sys.saving")}</span>
              </>
            ) : saved ? (
              <>
                <span>✓</span>
                <span>{tr("sys.savedTick")}</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>{tr("sys.save")}</span>
              </>
            )}
          </button>

          {error && (
            <p className="text-xs text-rose-400 font-semibold bg-rose-950/40 border border-rose-800/50 p-2.5 rounded-xl">
              {isCs
                ? `Nepodarilo sa uložiť (${error}). Skúste sa znova prihlásiť a zopakovať uloženie.`
                : `Could not save (${error}). Try signing in again and saving once more.`}
            </p>
          )}

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            {tr("sys.footer")}
          </p>
        </div>
      </div>
    </div>
  );
}
